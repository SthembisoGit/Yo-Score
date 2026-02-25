import axios from 'axios';
import { query } from '../db';
import { config } from '../config';

type ReadinessResult = {
  ready: boolean;
  checks: {
    database: {
      ok: boolean;
      latency_ms: number;
      message?: string;
    };
    ml_service: {
      ok: boolean;
      latency_ms: number;
      status_code?: number;
      message?: string;
    };
  };
};

const maxCheckTimeoutMs = 1500;

export const evaluateReadiness = async (): Promise<ReadinessResult> => {
  const dbStart = process.hrtime.bigint();
  const checks: ReadinessResult['checks'] = {
    database: {
      ok: false,
      latency_ms: 0,
    },
    ml_service: {
      ok: false,
      latency_ms: 0,
    },
  };

  try {
    await query('SELECT 1 as ready');
    checks.database.ok = true;
  } catch {
    checks.database.ok = false;
    checks.database.message = 'Database unavailable';
  } finally {
    checks.database.latency_ms = Math.round(Number(process.hrtime.bigint() - dbStart) / 1_000_000);
  }

  const mlStart = process.hrtime.bigint();
  try {
    const response = await axios.get(`${config.ML_SERVICE_URL}/health`, {
      timeout: maxCheckTimeoutMs,
      validateStatus: () => true,
    });
    checks.ml_service.ok = response.status >= 200 && response.status < 300;
    checks.ml_service.status_code = response.status;
    if (!checks.ml_service.ok) {
      checks.ml_service.message = 'ML service unavailable';
    }
  } catch {
    checks.ml_service.ok = false;
    checks.ml_service.message = 'ML service unavailable';
  } finally {
    checks.ml_service.latency_ms = Math.round(Number(process.hrtime.bigint() - mlStart) / 1_000_000);
  }

  return {
    ready: checks.database.ok && checks.ml_service.ok,
    checks,
  };
};
