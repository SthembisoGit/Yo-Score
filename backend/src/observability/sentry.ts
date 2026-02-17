import * as Sentry from '@sentry/node';
import { config } from '../config';

const sentryDsn = config.SENTRY_DSN;

export function initSentry() {
  if (!sentryDsn) return;

  Sentry.init({
    dsn: sentryDsn,
    environment: config.SENTRY_ENVIRONMENT || config.NODE_ENV,
    tracesSampleRate: Number(config.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!sentryDsn) return;
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => scope.setExtra(key, value));
    }
    Sentry.captureException(error);
  });
}
