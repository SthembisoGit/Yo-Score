import express from 'express';
import cors from 'cors';
import { config } from './config';
import pool from '../db';



const app = express();

app.use(cors({
  origin: config.FRONTEND_URL,
}));

app.use(express.json());

app.get('/', (_, res) => {
  res.json({
    message: 'YoScore API',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

app.get('/health', (_, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'YoScore API',
    timestamp: new Date().toISOString()
  });
});

app.get('/test-db', async (_, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      database: 'connected',
      provider: 'supabase',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ 
      database: 'error', 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

export default app;