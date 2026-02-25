import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import challengeRoutes from './routes/challenge.routes';
import submissionRoutes from './routes/submission.routes';
import dashboardRoutes from './routes/dashboard.routes';
import proctoringRoutes from './routes/proctoring.routes';
import adminRoutes from './routes/admin.routes';
import codeRoutes from './routes/code.routes';
import { enableJudge, runJudgeInApi } from './config';
import { getCorsConfig } from './utils/corsConfig';
import { captureException, initSentry } from './observability/sentry';
import { requestContext } from './middleware/requestContext.middleware';
import { enforceHttps } from './middleware/https.middleware';
import { logger } from './utils/logger';

initSentry();

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.set('query parser', 'simple');
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(enforceHttps);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      hsts:
        config.NODE_ENV === 'production'
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: false,
            }
          : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    next();
  });
  app.use(cors(getCorsConfig()));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.get('/', (_, res) => {
    res.status(200).json({
      success: true,
      message: 'YoScore API',
      data: {
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
        version: '0.1.0',
      },
    });
  });

  app.get('/health', (_, res) => {
    res.status(200).json({
      success: true,
      message: 'Service healthy',
      data: {
        status: 'OK',
        service: 'YoScore API',
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/challenges', challengeRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/proctoring', proctoringRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/code', codeRoutes);

  if (config.NODE_ENV === 'test') {
    app.get('/__test/error', (_req, _res) => {
      throw new Error('Intentional test error');
    });
  }

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const correlationId = req.correlationId || 'unknown';
    captureException(err, {
      path: req.originalUrl,
      method: req.method,
      correlationId,
    });

    logger.error('Unhandled server exception', {
      correlationId,
      path: req.originalUrl,
      method: req.method,
      error: err,
    });

    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      return res.status(413).json({
        success: false,
        message: 'Payload too large',
        correlation_id: correlationId,
        error: 'PAYLOAD_TOO_LARGE',
      });
    }

    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.parse.failed'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request payload',
        correlation_id: correlationId,
        error: 'INVALID_PAYLOAD',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unexpected server error',
      correlation_id: correlationId,
      error: 'INTERNAL_SERVER_ERROR',
    });
  });

  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
      correlation_id: req.correlationId || 'unknown',
      data: null,
    });
  });

  return app;
}

const app = createApp();

if (config.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => {
    logger.info('Server started', {
      port: config.PORT,
      environment: config.NODE_ENV,
      frontendOrigin: config.FRONTEND_URL,
    });
  });

  if (enableJudge && runJudgeInApi) {
    import('./worker')
      .then(() => {
        logger.info('Judge worker running inside API process');
      })
      .catch((error) => {
        captureException(error, { service: 'api', component: 'in-process-judge-worker' });
        logger.error('Failed to start in-process judge worker', { error });
      });
  }
}

export default app;
