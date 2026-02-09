// backend/src/utils/corsConfig.ts
import { CorsOptions } from 'cors';

/**
 * CORS configuration for YoScore API
 * Ensures secure cross-origin requests between frontend and backend
 */
export const getCorsConfig = (): CorsOptions => {
  const rawFrontendUrls = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = rawFrontendUrls
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return value;
      }
    });

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow requests from configured frontend origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // In development, allow localhost with different ports for testing
      if (process.env.NODE_ENV === 'development') {
        if (origin.includes('localhost') && allowedOrigins.some((value) => value.includes('localhost'))) {
          callback(null, true);
          return;
        }
      }

      // Reject all other origins
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-CSRF-Token'
    ],
    exposedHeaders: ['Authorization', 'X-CSRF-Token'],
    maxAge: 86400 // 24 hours in seconds
  };
};
