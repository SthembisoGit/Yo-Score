const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const backendRoot = path.resolve(__dirname, '..');

const standardsScopedFiles = [
  'src/controllers/auth.controller.ts',
  'src/services/auth.service.ts',
  'src/services/codeRun.service.ts',
  'src/repositories/auth.repository.ts',
  'src/repositories/challenge.repository.ts',
  'src/adapters/mlService.adapter.ts',
];

const fileLineLimits = {
  'src/controllers/auth.controller.ts': 200,
  'src/services/auth.service.ts': 300,
  'src/services/codeRun.service.ts': 120,
  'src/repositories/auth.repository.ts': 250,
  'src/repositories/challenge.repository.ts': 120,
  'src/adapters/mlService.adapter.ts': 200,
};

const readFile = (relativePath) =>
  fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

test('Coding standards: scoped files stay within configured size limits', () => {
  for (const relativePath of standardsScopedFiles) {
    const lineCount = readFile(relativePath).split('\n').length;
    const lineLimit = fileLineLimits[relativePath];
    assert.ok(
      lineCount <= lineLimit,
      `${relativePath} has ${lineCount} lines which exceeds limit ${lineLimit}`,
    );
  }
});

test('Coding standards: scoped files avoid vague identifiers', () => {
  const bannedIdentifiers = [
    /\b(?:const|let|var)\s+temp\b/,
    /\b(?:const|let|var)\s+data\b/,
    /\b(?:const|let|var)\s+usr\b/,
    /\b(?:const|let|var)\s+doThing\b/,
    /\b(?:const|let|var)\s+handle\b/,
  ];
  for (const relativePath of standardsScopedFiles) {
    const source = readFile(relativePath);
    for (const pattern of bannedIdentifiers) {
      assert.doesNotMatch(
        source,
        pattern,
        `${relativePath} uses banned vague identifier pattern: ${pattern}`,
      );
    }
  }
});

test('Coding standards: catch blocks in scoped files must log or throw', () => {
  const catchBlockPattern = /catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\}/g;

  for (const relativePath of standardsScopedFiles) {
    const source = readFile(relativePath);
    const blocks = [...source.matchAll(catchBlockPattern)];
    for (const block of blocks) {
      const catchBody = block[1] || '';
      const hasLogger = /logger\.(warn|error|info)\(/.test(catchBody);
      const hasThrow = /\bthrow\b/.test(catchBody);
      assert.ok(
        hasLogger || hasThrow,
        `${relativePath} has catch block without logger/throw`,
      );
    }
  }
});
