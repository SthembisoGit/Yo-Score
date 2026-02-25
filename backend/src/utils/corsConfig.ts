// backend/src/utils/corsConfig.ts
import { CorsOptions } from 'cors';

/**
 * CORS configuration for YoScore API
 * Ensures secure cross-origin requests between frontend and backend
 */
export const getCorsConfig = (): CorsOptions => {
  const rawFrontendUrls = process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:8080';
  const rawExtraOrigins = process.env.CORS_ALLOWED_ORIGINS || '';
  const allowedOrigins = `${rawFrontendUrls},${rawExtraOrigins}`
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

  const defaultDevOrigins = [
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];

  if (process.env.NODE_ENV !== 'production') {
    for (const origin of defaultDevOrigins) {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
      }
    }
  }

  const allowRenderOrigins = (
    process.env.ALLOW_RENDER_ORIGINS ??
    (process.env.NODE_ENV === 'development' ? 'true' : 'false')
  ).toLowerCase() === 'true';
  const renderOriginRegex = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i;

  const wildcardOrigins = allowedOrigins.filter((origin) => origin.startsWith('*.'));
  const exactOrigins = allowedOrigins.filter((origin) => !origin.startsWith('*.'));
  const wildcardMatch = (origin: string): boolean =>
    wildcardOrigins.some((pattern) => {
      const suffix = pattern.slice(1).toLowerCase();
      return origin.toLowerCase().endsWith(suffix);
    });

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow requests from configured frontend origins
      if (exactOrigins.includes(origin) || wildcardMatch(origin)) {
        callback(null, true);
        return;
      }

      // Optional Render wildcard support for multi-service deployments.
      if (allowRenderOrigins && renderOriginRegex.test(origin)) {
        callback(null, true);
        return;
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
