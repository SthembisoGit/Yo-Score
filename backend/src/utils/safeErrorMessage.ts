const sensitivePatterns = [
  /syntax error/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /password authentication failed/i,
  /connect|timeout|econn|enotfound/i,
  /invalid input syntax/i,
];

export const safeErrorMessage = (
  error: unknown,
  fallback: string,
  allowedMessages: string[] = [],
): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message?.trim();
  if (!message) {
    return fallback;
  }

  if (allowedMessages.includes(message)) {
    return message;
  }

  if (sensitivePatterns.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  if (message.length > 220) {
    return fallback;
  }

  return message;
};

