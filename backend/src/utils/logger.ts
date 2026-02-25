const REDACT_PATTERNS: RegExp[] = [
  /(bearer\s+)[a-z0-9\.\-_]+/gi,
  /(password["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
  /(api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
  /(token["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
  /(cookie["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
];

const redactString = (input: string): string => {
  let output = input;
  for (const pattern of REDACT_PATTERNS) {
    output = output.replace(pattern, (_, prefix: string) => `${prefix}[REDACTED]`);
  }
  return output;
};

const safeSerialize = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message || 'Error'),
      stack:
        process.env.NODE_ENV === 'production'
          ? undefined
          : redactString(value.stack || ''),
    };
  }
  if (Array.isArray(value)) return value.map((item) => safeSerialize(item));
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      safeSerialize(item),
    ]);
    return Object.fromEntries(entries);
  }
  return String(value);
};

type LogLevel = 'info' | 'warn' | 'error';

const emit = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = {
    level,
    message: redactString(message),
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: safeSerialize(meta) } : {}),
  };
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  console.log(serialized);
};

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    emit('info', message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit('warn', message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit('error', message, meta);
  },
  redact(input: string) {
    return redactString(input);
  },
};

export default logger;
