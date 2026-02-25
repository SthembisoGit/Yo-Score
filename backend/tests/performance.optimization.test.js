const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

test('Performance optimization: DB pool uses bounded and configurable connection settings', () => {
  const dbPath = path.join(backendRoot, 'src', 'db', 'index.ts');
  const content = fs.readFileSync(dbPath, 'utf8');

  assert.match(content, /max:\s*Number\(process\.env\.PG_POOL_MAX/);
  assert.match(content, /min:\s*Number\(process\.env\.PG_POOL_MIN/);
  assert.match(content, /query_timeout:\s*Number\(process\.env\.PG_QUERY_TIMEOUT_MS/);
  assert.match(content, /statement_timeout:\s*Number\(process\.env\.PG_STATEMENT_TIMEOUT_MS/);
});

test('Performance optimization: slow query logging is enabled for diagnostics', () => {
  const dbPath = path.join(backendRoot, 'src', 'db', 'index.ts');
  const content = fs.readFileSync(dbPath, 'utf8');

  assert.match(content, /slowQueryThresholdMs/);
  assert.match(content, /Slow database query detected/);
  assert.match(content, /statement_hash/);
});

test('Performance optimization: ML analysis retrieval avoids wildcard projection', () => {
  const servicePath = path.join(backendRoot, 'src', 'services', 'proctoring.service.ts');
  const content = fs.readFileSync(servicePath, 'utf8');

  assert.ok(!/SELECT \*/i.test(content));
  assert.match(content, /SELECT id,\s*session_id,\s*analysis_type,\s*timestamp,\s*results,\s*violations_detected,\s*created_at/i);
});
