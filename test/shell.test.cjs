'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeShell } = require('../src/shell-analysis.cjs');

test('test runners classify as control, so a review can gather evidence', () => {
  const commands = [
    'npm test', 'npm t', 'npm run test', 'npm run test:unit', 'pnpm test', 'yarn test', 'bun test',
    'node --test', 'node --test test/', 'pytest -q', 'python -m pytest', 'cargo test',
    'go test ./...', 'ctest --output-on-failure', 'npx vitest run'
  ];
  for (const command of commands) {
    assert.equal(analyzeShell(command).mutability, 'control', command);
  }
});

test('builds, installs, and arbitrary scripts stay out of control', () => {
  assert.equal(analyzeShell('npm run build').mutability, 'unknown');
  assert.equal(analyzeShell('npm install left-pad').mutability, 'write');
  assert.equal(analyzeShell('node scripts/migrate.js').mutability, 'unknown');
  assert.equal(analyzeShell('npm test > out.txt').mutability, 'write');
});
