import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

const CORRELATION_HEADER = 'x-correlation-id';

export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  const inbound = req.header(CORRELATION_HEADER);
  const correlationId = inbound && inbound.trim().length > 0 ? inbound.trim() : randomUUID();
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_HEADER, correlationId);
  next();
};

export const getCorrelationHeader = () => CORRELATION_HEADER;

