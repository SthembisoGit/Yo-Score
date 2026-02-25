const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const projectRoot = path.resolve(__dirname, '..');

const walkFiles = (rootDir) => {
  const output = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        output.push(fullPath);
      }
    }
  }
  return output;
};

const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('Controllers and routes do not import database layer directly', () => {
  const transportFiles = [
    ...walkFiles(path.join(projectRoot, 'src', 'controllers')),
    ...walkFiles(path.join(projectRoot, 'src', 'routes')),
  ];
  for (const file of transportFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      content,
      /from\s+['"]\.\.\/db['"]/,
      `Transport layer must not import db directly: ${file}`,
    );
  }
});

test('Auth and code run services use repositories instead of direct db import', () => {
  const authService = read('src/services/auth.service.ts');
  const codeRunService = read('src/services/codeRun.service.ts');

  assert.match(authService, /from\s+['"]\.\.\/repositories\/auth\.repository['"]/);
  assert.match(codeRunService, /from\s+['"]\.\.\/repositories\/challenge\.repository['"]/);

  assert.doesNotMatch(authService, /from\s+['"]\.\.\/db['"]/);
  assert.doesNotMatch(codeRunService, /from\s+['"]\.\.\/db['"]/);
});

test('Proctoring service uses ML adapter and does not call axios directly', () => {
  const proctoringService = read('src/services/proctoring.service.ts');

  assert.match(
    proctoringService,
    /from\s+['"]\.\.\/adapters\/mlService\.adapter['"]/,
  );
  assert.doesNotMatch(proctoringService, /from\s+['"]axios['"]/);
});
