import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

const isSecureRequest = (req: Request): boolean => {
  if (req.secure) return true;
  const forwardedProto = req.header('x-forwarded-proto');
  if (!forwardedProto) return false;
  return forwardedProto.split(',')[0]?.trim() === 'https';
};

export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  if (config.NODE_ENV !== 'production') {
    next();
    return;
  }

  if (isSecureRequest(req)) {
    next();
    return;
  }

  const host = req.header('host');
  if (!host) {
    return res.status(400).json({
      success: false,
      message: 'HTTPS is required in production',
      error: 'HTTPS_REQUIRED',
    });
  }

  const target = `https://${host}${req.originalUrl}`;
  return res.redirect(308, target);
};

