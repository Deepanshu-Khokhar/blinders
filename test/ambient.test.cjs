'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseContractPrompt, defaultContract } = require('../src/contracts.cjs');

function armed(prompt, previous = defaultContract()) {
  return parseContractPrompt(prompt, previous).contract;
}

test('a read-only request arms review without a directive', () => {
  for (const prompt of [
    'review this PR and tell me what is wrong',
    'can you explain how the scheduler works?',
    'why does the login page crash when I click save?',
    'review the diff, do not edit it',
    'no code changes, just explain the flow'
  ]) {
    const contract = armed(prompt);
    assert.equal(contract.mode, 'review', prompt);
    assert.equal(contract.level, 'guard', prompt);
    assert.equal(contract.source, 'ambient', prompt);
  }
});

test('implementation work arms change', () => {
  for (const prompt of [
    'fix the failing auth test',
    'refactor the retry loop into one helper',
    "don't change the API, fix the parser",
    'check the logs and fix the retry loop'
  ]) {
    assert.equal(armed(prompt).mode, 'change', prompt);
  }
});

test('a shape the request does not state stays open', () => {
  assert.equal(armed('the login page crashes when I click save').mode, 'open');
  assert.equal(armed('thanks!').mode, 'open');
  assert.equal(armed('').mode, 'unconfirmed');
  assert.equal(armed('').level, 'watch');
});

test('a named dependency widens only the dependency policy', () => {
  assert.equal(armed('install zod').dependencyPolicy, 'allow');
  assert.equal(armed('add zod validation to the signup form').dependencyPolicy, 'allow');
  assert.equal(armed('bump react to the latest').dependencyPolicy, 'allow');
  assert.equal(armed('add a test for the parser').dependencyPolicy, 'ask');
  assert.equal(armed('add logging around the retry loop').dependencyPolicy, 'ask');
  assert.equal(armed('install it locally and run the tests').dependencyPolicy, 'ask');
  assert.equal(armed("don't add a dependency, fix it in place").dependencyPolicy, 'ask');
});

test('fenced and quoted text cannot arm a turn', () => {
  const contract = armed('> fix this\nreview the diff');
  assert.equal(contract.mode, 'review');
  assert.equal(armed('```\nfix the parser\n```\nwhat does it do?').mode, 'review');
});

test('later turns escalate and narrow', () => {
  const review = armed('review the retry logic');
  const change = parseContractPrompt('ok now fix it', review).contract;
  assert.equal(change.mode, 'change');
  const back = parseContractPrompt('now review the diff', change).contract;
  assert.equal(back.mode, 'review');
});

test('a typed directive outranks inference', () => {
  const directive = armed('$blinders review files=src/** -- audit retries');
  assert.equal(directive.mode, 'review');
  assert.deepEqual(directive.allowedPaths, ['src/**']);
  const next = parseContractPrompt('install zod', directive).contract;
  assert.equal(next.mode, 'review');
  assert.equal(next.dependencyPolicy, 'ask');
  assert.equal(next.source, 'directive');
});

test('an explicit off is not overridden', () => {
  const off = armed('$blinders off');
  assert.equal(off.level, 'off');
  assert.equal(parseContractPrompt('fix the parser', off).contract.level, 'off');
});
