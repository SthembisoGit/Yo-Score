export type RiskState = 'observe' | 'warn' | 'elevated' | 'paused';

export interface RiskSignal {
  event_type: string;
  severity: 'low' | 'medium' | 'high';
  confidence?: number | null;
  duration_ms?: number | null;
  created_at?: Date | string | null;
}

export interface RiskEvaluation {
  riskState: RiskState;
  riskScore: number;
  pauseRecommended: boolean;
  livenessRequired: boolean;
  reasons: string[];
}

const DEVICE_INTEGRITY_EVENTS = new Set(['camera_off', 'microphone_off', 'audio_off', 'heartbeat_timeout']);

const HIGH_DURATION_MS = 6000;
const HIGH_REPEAT_COUNT = 3;
const CORROBORATION_WINDOW_MS = 15000;

function toMs(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hasCorroboratedHighSignals(
  signals: Array<{ type: string; ts: number; confidence: number }>,
): { matched: boolean; reason?: string } {
  if (signals.length < 2) return { matched: false };

  for (let i = 0; i < signals.length; i += 1) {
    for (let j = i + 1; j < signals.length; j += 1) {
      const a = signals[i];
      const b = signals[j];
      if (a.type === b.type) continue;
      if (Math.abs(a.ts - b.ts) <= CORROBORATION_WINDOW_MS) {
        return {
          matched: true,
          reason: `Corroborated high-risk signals (${a.type} + ${b.type})`,
        };
      }
    }
  }

  return { matched: false };
}

export function evaluateRiskSignals(
  rawSignals: RiskSignal[],
  opts: {
    windowSeconds: number;
    highConfidenceThreshold: number;
    nowMs?: number;
  },
): RiskEvaluation {
  const nowMs = opts.nowMs ?? Date.now();
  const windowMs = Math.max(5000, Math.floor(opts.windowSeconds * 1000));
  const highThreshold = clamp(opts.highConfidenceThreshold, 0.5, 0.99);
  const cutoff = nowMs - windowMs;

  const signals = rawSignals
    .map((signal) => ({
      type: String(signal.event_type || '').trim().toLowerCase(),
      severity:
        signal.severity === 'high' || signal.severity === 'medium' || signal.severity === 'low'
          ? signal.severity
          : 'low',
      confidence: clamp(Number(signal.confidence ?? 0.5), 0, 1),
      durationMs: Math.max(0, Number(signal.duration_ms ?? 0)),
      ts: toMs(signal.created_at),
    }))
    .filter((signal) => signal.type.length > 0 && signal.ts >= cutoff);

  if (signals.length === 0) {
    return {
      riskState: 'observe',
      riskScore: 0,
      pauseRecommended: false,
      livenessRequired: false,
      reasons: [],
    };
  }

  const highSignals = signals.filter(
    (signal) => signal.severity === 'high' && signal.confidence >= highThreshold,
  );
  const mediumSignals = signals.filter(
    (signal) => signal.severity !== 'low' && signal.confidence >= Math.max(0.55, highThreshold - 0.2),
  );
  const uniqueTypes = new Set(signals.map((signal) => signal.type));

  const byType = new Map<string, { count: number; maxDuration: number }>();
  for (const signal of highSignals) {
    const current = byType.get(signal.type) ?? { count: 0, maxDuration: 0 };
    current.count += 1;
    current.maxDuration = Math.max(current.maxDuration, signal.durationMs);
    byType.set(signal.type, current);
  }

  const reasons: string[] = [];

  for (const [type, stats] of byType.entries()) {
    if (stats.count >= HIGH_REPEAT_COUNT || stats.maxDuration >= HIGH_DURATION_MS) {
      reasons.push(`Sustained high-risk signal: ${type}`);
      break;
    }
  }

  const corroborationCheck = hasCorroboratedHighSignals(
    highSignals.map((signal) => ({
      type: signal.type,
      ts: signal.ts,
      confidence: signal.confidence,
    })),
  );
  if (corroborationCheck.matched && corroborationCheck.reason) {
    reasons.push(corroborationCheck.reason);
  }

  const longDurationHigh = highSignals.filter((signal) => signal.durationMs >= HIGH_DURATION_MS).length;
  const score = clamp(
    highSignals.length * 16 +
      mediumSignals.length * 7 +
      uniqueTypes.size * 4 +
      longDurationHigh * 8,
    0,
    100,
  );

  let riskState: RiskState = 'observe';
  let pauseRecommended = false;

  if (reasons.length > 0) {
    riskState = 'paused';
    pauseRecommended = true;
  } else if (score >= 55) {
    riskState = 'elevated';
  } else if (score >= 25) {
    riskState = 'warn';
  }

  const highTypes = new Set(highSignals.map((signal) => signal.type));
  const allHighAreDeviceIntegrity =
    highTypes.size > 0 && Array.from(highTypes).every((type) => DEVICE_INTEGRITY_EVENTS.has(type));

  return {
    riskState,
    riskScore: score,
    pauseRecommended,
    livenessRequired: pauseRecommended && !allHighAreDeviceIntegrity,
    reasons,
  };
}

