const PENALTY_SCALE = 0.7;

function scalePenalty(value: number): number {
  return Math.max(1, Math.round(value * PENALTY_SCALE));
}

const RAW_DEFAULT_VIOLATION_PENALTY = 3;
const RAW_VIOLATION_PENALTIES: Record<string, number> = {
  camera_off: 8,
  microphone_off: 8,
  audio_off: 6,
  tab_switch: 4,
  screen_switch: 4,
  window_blur: 2,
  inactivity: 2,
  multiple_faces: 10,
  no_face: 6,
  looking_away: 4,
  eyes_closed: 2,
  face_covered: 4,
  copy_paste: 10,
  dev_tools: 10,
  speech_detected: 6,
  multiple_voices: 12,
  forbidden_object: 12,
  multiple_screens: 8,
  high_background_noise: 2,
  suspicious_conversation: 10,
  heartbeat_timeout: 8,
};

export const DEFAULT_VIOLATION_PENALTY = scalePenalty(RAW_DEFAULT_VIOLATION_PENALTY);

export const VIOLATION_PENALTIES: Record<string, number> = Object.fromEntries(
  Object.entries(RAW_VIOLATION_PENALTIES).map(([type, penalty]) => [type, scalePenalty(penalty)]),
) as Record<string, number>;

export function normalizeViolationType(type: string): string {
  return type.toLowerCase().replace(/-/g, '_').trim();
}

export function getViolationPenalty(type: string): number {
  return VIOLATION_PENALTIES[normalizeViolationType(type)] ?? DEFAULT_VIOLATION_PENALTY;
}
