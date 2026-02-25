type RequestObservation = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

type RouteMetric = {
  count: number;
  errors: number;
  totalDurationMs: number;
};

const MAX_LATENCY_SAMPLES = 2000;

const startedAt = Date.now();
let requestCount = 0;
let errorCount = 0;
let serverErrorCount = 0;
let authFailureCount = 0;
let rateLimitCount = 0;

const statusCounts = new Map<number, number>();
const routeMetrics = new Map<string, RouteMetric>();
const recentLatencies: number[] = [];

const pushLatencySample = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  if (recentLatencies.length >= MAX_LATENCY_SAMPLES) {
    recentLatencies.shift();
  }
  recentLatencies.push(durationMs);
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index]);
};

export const observeRequest = (observation: RequestObservation) => {
  requestCount += 1;
  if (observation.statusCode >= 400) {
    errorCount += 1;
  }
  if (observation.statusCode >= 500) {
    serverErrorCount += 1;
  }

  statusCounts.set(observation.statusCode, (statusCounts.get(observation.statusCode) ?? 0) + 1);
  pushLatencySample(observation.durationMs);

  const routeKey = `${observation.method} ${observation.path}`;
  const route = routeMetrics.get(routeKey) ?? {
    count: 0,
    errors: 0,
    totalDurationMs: 0,
  };
  route.count += 1;
  route.totalDurationMs += observation.durationMs;
  if (observation.statusCode >= 400) {
    route.errors += 1;
  }
  routeMetrics.set(routeKey, route);
};

export const observeAuthFailure = () => {
  authFailureCount += 1;
};

export const observeRateLimit = () => {
  rateLimitCount += 1;
};

export const getMetricsSnapshot = () => {
  const avgLatencyMs =
    recentLatencies.length === 0
      ? 0
      : Math.round(recentLatencies.reduce((sum, value) => sum + value, 0) / recentLatencies.length);

  const routes = Array.from(routeMetrics.entries())
    .map(([route, metric]) => ({
      route,
      requests: metric.count,
      errors: metric.errors,
      avg_latency_ms: metric.count > 0 ? Math.round(metric.totalDurationMs / metric.count) : 0,
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 25);

  return {
    started_at: new Date(startedAt).toISOString(),
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    requests_total: requestCount,
    errors_total: errorCount,
    server_errors_total: serverErrorCount,
    auth_failures_total: authFailureCount,
    rate_limit_total: rateLimitCount,
    latency_ms: {
      p50: percentile(recentLatencies, 50),
      p95: percentile(recentLatencies, 95),
      avg: avgLatencyMs,
      sample_size: recentLatencies.length,
    },
    status_codes: Object.fromEntries(statusCounts.entries()),
    top_routes: routes,
  };
};

export const resetMetricsForTests = () => {
  requestCount = 0;
  errorCount = 0;
  serverErrorCount = 0;
  authFailureCount = 0;
  rateLimitCount = 0;
  statusCounts.clear();
  routeMetrics.clear();
  recentLatencies.length = 0;
};
