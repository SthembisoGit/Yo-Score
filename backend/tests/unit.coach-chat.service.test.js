process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isExplicitSolutionRequest,
  sanitizeCoachChatOutput,
} = require('../dist/src/services/coachChat.service');

test('isExplicitSolutionRequest flags direct answer requests', () => {
  assert.equal(isExplicitSolutionRequest('Please give me the full solution for this challenge.'), true);
  assert.equal(isExplicitSolutionRequest('Help me debug my edge case handling.'), false);
});

test('sanitizeCoachChatOutput extracts assistant message and trims snippet lines', () => {
  const payload = sanitizeCoachChatOutput(`{
    "assistant_message": "Check your loop bounds first.",
    "snippet": "line1\\nline2\\nline3\\nline4\\nline5\\nline6\\nline7\\nline8\\nline9"
  }`);

  assert.equal(payload.assistant_message, 'Check your loop bounds first.');
  assert.equal(payload.snippet.split('\n').length, 8);
});
