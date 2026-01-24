// backend/src/utils/corsConfig.ts
import { CorsOptions } from 'cors';

/**
 * CORS configuration for YoScore API
 * Ensures secure cross-origin requests between frontend and backend
 */
export const getCorsConfig = (): CorsOptions => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
  
  let allowedOrigin: string;
  try {
    const url = new URL(frontendUrl);
    allowedOrigin = url.origin;
  } catch {
    allowedOrigin = frontendUrl;
  }

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow requests from the configured frontend origin
      if (origin === allowedOrigin) {
        callback(null, true);
        return;
      }

      // In development, allow localhost with different ports for testing
      if (process.env.NODE_ENV === 'development') {
        if (origin.includes('localhost') && allowedOrigin.includes('localhost')) {
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