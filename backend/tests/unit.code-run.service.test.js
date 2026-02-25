process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CodeRunService } = require('../dist/src/services/codeRun.service');
const { challengeRepository } = require('../dist/src/repositories/challenge.repository');
const { executionService } = require('../dist/src/services/execution.service');

const originalChallengeRepositoryMethod = challengeRepository.findChallengePublishState;
const originalExecutionServiceMethod = executionService.runCode;

test.afterEach(() => {
  challengeRepository.findChallengePublishState = originalChallengeRepositoryMethod;
  executionService.runCode = originalExecutionServiceMethod;
});

test('should_reject_code_run_when_challenge_does_not_exist', async () => {
  challengeRepository.findChallengePublishState = async () => null;

  const codeRunService = new CodeRunService();

  await assert.rejects(
    () =>
      codeRunService.runCode('11111111-1111-1111-1111-111111111111', {
        language: 'javascript',
        code: 'console.log(1);',
        challenge_id: '22222222-2222-2222-2222-222222222222',
      }),
    /Challenge not found/,
  );
});

test('should_reject_code_run_when_challenge_is_not_published', async () => {
  challengeRepository.findChallengePublishState = async () => ({
    id: '22222222-2222-2222-2222-222222222222',
    publish_status: 'draft',
  });

  const codeRunService = new CodeRunService();

  await assert.rejects(
    () =>
      codeRunService.runCode('11111111-1111-1111-1111-111111111111', {
        language: 'javascript',
        code: 'console.log(1);',
        challenge_id: '22222222-2222-2222-2222-222222222222',
      }),
    /Challenge is not published/,
  );
});

test('should_execute_code_and_return_normalized_result_payload', async () => {
  challengeRepository.findChallengePublishState = async () => ({
    id: '22222222-2222-2222-2222-222222222222',
    publish_status: 'published',
  });
  executionService.runCode = async () => ({
    stdout: 'hello\n',
    stderr: '',
    exit_code: 0,
    timed_out: false,
    runtime_ms: 12,
    memory_kb: 6400,
    truncated: false,
    provider: 'local',
    error_class: undefined,
  });

  const codeRunService = new CodeRunService();
  const result = await codeRunService.runCode('11111111-1111-1111-1111-111111111111', {
    language: 'javascript',
    code: 'console.log("hello");',
    stdin: '',
    challenge_id: '22222222-2222-2222-2222-222222222222',
  });

  assert.equal(result.language, 'javascript');
  assert.equal(result.stdout, 'hello\n');
  assert.equal(result.exit_code, 0);
  assert.equal(result.provider, 'local');
  assert.equal(result.timed_out, false);
});
