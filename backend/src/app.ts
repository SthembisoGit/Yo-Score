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

initSentry();

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.set('query parser', 'simple');
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
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

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    captureException(err, {
      path: req.originalUrl,
      method: req.method,
    });

    const message =
      config.NODE_ENV === 'development' && err instanceof Error
        ? err.message
        : 'Unexpected server error';
    return res.status(500).json({
      success: false,
      message,
      error: 'INTERNAL_SERVER_ERROR',
    });
  });

  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
      data: null,
    });
  });

  return app;
}

const app = createApp();

if (config.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Frontend origin: ${config.FRONTEND_URL}`);
  });

  if (enableJudge && runJudgeInApi) {
    import('./worker')
      .then(() => {
        console.log('Judge worker running inside API process.');
      })
      .catch((error) => {
        captureException(error, { service: 'api', component: 'in-process-judge-worker' });
        console.error('Failed to start in-process judge worker:', error);
      });
  }
}

export default app;
