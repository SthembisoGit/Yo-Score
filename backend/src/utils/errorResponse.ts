import type { Request } from 'express';

type ErrorMeta = {
  correlationId: string;
  retryAfterSeconds?: number;
};

type ErrorInfo = {
  code: string;
  message: string;
  correlationId: string;
  retryAfterSeconds?: number;
};

export type StructuredErrorResponse = {
  success: false;
  message: string;
  error: string;
  meta: ErrorMeta;
  error_details: ErrorInfo;
  error_response: ErrorInfo;
};

export const getCorrelationId = (req: Request): string => req.correlationId || 'unknown';

export const buildStructuredErrorResponse = (
  req: Request,
  code: string,
  message: string,
  options?: { retryAfterSeconds?: number },
): StructuredErrorResponse => {
  const correlationId = getCorrelationId(req);
  const errorInfo: ErrorInfo = {
    code,
    message,
    correlationId,
    ...(typeof options?.retryAfterSeconds === 'number'
      ? { retryAfterSeconds: options.retryAfterSeconds }
      : {}),
  };

  return {
    success: false,
    message,
    error: code,
    meta: {
      correlationId,
      ...(typeof options?.retryAfterSeconds === 'number'
        ? { retryAfterSeconds: options.retryAfterSeconds }
        : {}),
    },
    error_details: errorInfo,
    error_response: errorInfo,
  };
};
