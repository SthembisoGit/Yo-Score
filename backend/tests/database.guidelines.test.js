const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

const walkFiles = (dir, acc = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }
    acc.push(fullPath);
  }
  return acc;
};

test('Database guidelines: backend source avoids SELECT * queries', () => {
  const sourceFiles = walkFiles(path.join(backendRoot, 'src')).filter((file) =>
    file.endsWith('.ts'),
  );
  const offenders = [];
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (/select\s+\*/i.test(content)) {
      offenders.push(path.relative(backendRoot, file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `SELECT * found in backend source files:\n${offenders.join('\n')}`,
  );
});

test('Database guidelines: schema includes key indexes for frequently filtered columns', () => {
  const schemaPath = path.join(backendRoot, 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const requiredIndexes = [
    'idx_submissions_user_id',
    'idx_submissions_challenge_id',
    'idx_work_experience_user_id',
    'idx_proctoring_sessions_user_id',
    'idx_proctoring_event_logs_session_id',
    'idx_proctoring_snapshots_session_id',
  ];

  const missing = requiredIndexes.filter((indexName) => !schema.includes(indexName));

  assert.deepEqual(
    missing,
    [],
    `Missing required indexes in schema.sql:\n${missing.join('\n')}`,
  );
});
