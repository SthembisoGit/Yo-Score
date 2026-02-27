process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ENABLE_JUDGE = 'false';
process.env.STRICT_REAL_SCORING = 'false';
process.env.PROCTORING_SUBMISSION_WAIT_SECONDS = '1';
process.env.PROCTORING_SUBMISSION_WAIT_POLL_MS = '10';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../dist/src/db');
const { judgeService } = require('../dist/src/services/judge.service');
const { SubmissionService } = require('../dist/src/services/submission.service');

const originalQuery = db.query;
const originalReadinessCheck = judgeService.isChallengeReadyForLanguage;

const restoreAll = () => {
  db.query = originalQuery;
  judgeService.isChallengeReadyForLanguage = originalReadinessCheck;
};

const buildSubmissionRow = () => ({
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  user_id: '11111111-1111-1111-1111-111111111111',
  challenge_id: '22222222-2222-2222-2222-222222222222',
  code: 'print(1)',
  language: 'python',
  status: 'pending',
  judge_status: 'queued',
  submitted_at: new Date().toISOString(),
});

test.afterEach(() => {
  restoreAll();
});

test('should_wait_for_snapshot_processing_before_creating_submission', async () => {
  let pendingChecks = 0;

  judgeService.isChallengeReadyForLanguage = async () => true;
  db.query = async (text) => {
    if (text.includes('SELECT status, pause_reason, deadline_at')) {
      return {
        rows: [
          {
            status: 'active',
            pause_reason: null,
            deadline_at: new Date(Date.now() + 60_000).toISOString(),
            snapshot_processing_pending: 1,
          },
        ],
      };
    }

    if (text.includes('SELECT COALESCE(snapshot_processing_pending, 0)::int AS pending')) {
      pendingChecks += 1;
      return {
        rows: [
          {
            pending: pendingChecks === 1 ? 1 : 0,
          },
        ],
      };
    }

    if (text.includes('FROM challenges')) {
      return {
        rows: [{ id: '22222222-2222-2222-2222-222222222222', publish_status: 'published' }],
      };
    }

    if (text.includes('INSERT INTO submissions')) {
      return {
        rows: [buildSubmissionRow()],
      };
    }

    if (text.includes('UPDATE proctoring_logs')) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unexpected query in test: ${text}`);
  };

  const service = new SubmissionService();
  const result = await service.createSubmission('11111111-1111-1111-1111-111111111111', {
    challenge_id: '22222222-2222-2222-2222-222222222222',
    code: 'print(1)',
    language: 'python',
    session_id: '33333333-3333-3333-3333-333333333333',
  });

  assert.equal(result.submission_id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(result.judge_status, 'queued');
  assert.equal(pendingChecks, 2);
});

test('should_allow_timeout_submit_when_deadline_reached_even_if_session_is_paused', async () => {
  let insertCalled = false;

  judgeService.isChallengeReadyForLanguage = async () => true;
  db.query = async (text) => {
    if (text.includes('SELECT status, pause_reason, deadline_at')) {
      return {
        rows: [
          {
            status: 'paused',
            pause_reason: 'Required proctoring device unavailable: camera',
            deadline_at: new Date(Date.now() - 1_000).toISOString(),
            snapshot_processing_pending: 0,
          },
        ],
      };
    }

    if (text.includes('SELECT COALESCE(snapshot_processing_pending, 0)::int AS pending')) {
      return { rows: [{ pending: 0 }] };
    }

    if (text.includes('FROM challenges')) {
      return {
        rows: [{ id: '22222222-2222-2222-2222-222222222222', publish_status: 'published' }],
      };
    }

    if (text.includes('INSERT INTO submissions')) {
      insertCalled = true;
      return {
        rows: [buildSubmissionRow()],
      };
    }

    if (text.includes('UPDATE proctoring_logs')) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unexpected query in test: ${text}`);
  };

  const service = new SubmissionService();
  const result = await service.createSubmission('11111111-1111-1111-1111-111111111111', {
    challenge_id: '22222222-2222-2222-2222-222222222222',
    code: 'print(1)',
    language: 'python',
    session_id: '33333333-3333-3333-3333-333333333333',
    timeout_submit: true,
  });

  assert.equal(insertCalled, true);
  assert.equal(result.status, 'pending');
});

test('should_return_retryable_error_when_snapshot_processing_does_not_finish_within_wait_window', async () => {
  judgeService.isChallengeReadyForLanguage = async () => true;
  db.query = async (text) => {
    if (text.includes('SELECT status, pause_reason, deadline_at')) {
      return {
        rows: [
          {
            status: 'active',
            pause_reason: null,
            deadline_at: new Date(Date.now() + 60_000).toISOString(),
            snapshot_processing_pending: 1,
          },
        ],
      };
    }

    if (text.includes('SELECT COALESCE(snapshot_processing_pending, 0)::int AS pending')) {
      return { rows: [{ pending: 1 }] };
    }

    throw new Error(`Unexpected query in test: ${text}`);
  };

  const service = new SubmissionService();
  await assert.rejects(
    () =>
      service.createSubmission('11111111-1111-1111-1111-111111111111', {
        challenge_id: '22222222-2222-2222-2222-222222222222',
        code: 'print(1)',
        language: 'python',
        session_id: '33333333-3333-3333-3333-333333333333',
      }),
    /still in progress/i,
  );
});
