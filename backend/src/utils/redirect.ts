const DEFAULT_REDIRECT = '/dashboard';

const hasUnsafePrefix = (value: string): boolean =>
  value.startsWith('//') ||
  value.startsWith('/\\') ||
  value.includes('\u0000') ||
  value.includes('\r') ||
  value.includes('\n');

export const sanitizeRedirectPath = (
  value: unknown,
  fallback = DEFAULT_REDIRECT,
): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (!trimmed.startsWith('/')) return fallback;
  if (hasUnsafePrefix(trimmed)) return fallback;

  try {
    // Reject absolute URLs while allowing relative paths and query/hash suffixes.
    const parsed = new URL(trimmed, 'https://yoscore.local');
    if (parsed.origin !== 'https://yoscore.local') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};

export default sanitizeRedirectPath;
