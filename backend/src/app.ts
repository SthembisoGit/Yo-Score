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
import { getCorsConfig } from './utils/corsConfig';


const app = express();

app.disable('x-powered-by');
app.use(
  helmet({
    // API only; no browser-rendered HTML from this service.
    contentSecurityPolicy: false,
  }),
);
app.use(cors(getCorsConfig()));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/', (_, res) => {
  res.json({
    message: 'YoScore API',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '0.1.0'
  });
});

app.get('/health', (_, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'YoScore API',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/proctoring', proctoringRoutes);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'NOT_FOUND'
  });
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Frontend origin: ${config.FRONTEND_URL}`);
});

export default app;
