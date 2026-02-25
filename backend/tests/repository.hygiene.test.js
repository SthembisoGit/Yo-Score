const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

const trackedFiles = () => {
  const output = execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const forbiddenPathMatchers = [
  /^.*\.env$/i,
  /^.*\.env\.(?!example$).+$/i,
  /(^|\/)node_modules\//i,
  /(^|\/)dist\//i,
  /(^|\/)build\//i,
  /(^|\/)\.next\//i,
  /(^|\/)coverage\//i,
  /(^|\/)\.DS_Store$/i,
  /(^|\/)Thumbs\.db$/i,
];

test('Repository hygiene: tracked paths do not include forbidden local/build artifacts', () => {
  const files = trackedFiles();
  const violations = files.filter((file) =>
    forbiddenPathMatchers.some((pattern) => pattern.test(file)),
  );

  assert.deepEqual(
    violations,
    [],
    `Forbidden files are tracked:\n${violations.join('\n')}`,
  );
});

test('Repository hygiene: no obvious private key material in tracked files', () => {
  const files = trackedFiles();
  const violations = [];
  for (const relativePath of files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) continue;
    if (stat.size > 1_500_000) continue;

    const content = fs.readFileSync(absolutePath, 'utf8');
    if (
      content.includes('-----BEGIN PRIVATE KEY-----') ||
      content.includes('-----BEGIN RSA PRIVATE KEY-----') ||
      content.includes('-----BEGIN OPENSSH PRIVATE KEY-----')
    ) {
      violations.push(relativePath);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Private key material found in tracked files:\n${violations.join('\n')}`,
  );
});

test('Repository hygiene: tracked file sizes stay within practical source-control limits', () => {
  const files = trackedFiles();
  const oversized = [];
  for (const relativePath of files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) continue;
    if (stat.size > 2_000_000) {
      oversized.push(`${relativePath} (${stat.size} bytes)`);
    }
  }

  assert.deepEqual(
    oversized,
    [],
    `Large tracked files detected (consider object storage/LFS):\n${oversized.join('\n')}`,
  );
});
