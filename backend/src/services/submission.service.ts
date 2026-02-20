import { query } from '../db';
import { enableJudge, strictRealScoring } from '../config';
import { judgeQueue, defaultJobOptions } from '../queue/judgeQueue';
import { judgeService } from './judge.service';
import { scoringService } from './scoring.service';
import { submissionRunService } from './submissionRun.service';

export interface SubmissionInput {
  challenge_id: string;
  code: string;
  language: 'javascript' | 'python';
  session_id?: string;
}

function normalizeLanguage(language: string): 'javascript' | 'python' {
  const lower = language.toLowerCase();
  if (lower === 'python' || lower === 'py') return 'python';
  if (lower === 'javascript' || lower === 'js' || lower === 'node') return 'javascript';
  throw new Error('Unsupported language. Allowed: javascript, python');
}

const PRACTICE_GUIDANCE_BY_VIOLATION: Record<string, string> = {
  tab_switch: 'Practice in a distraction-free setup and keep the challenge tab focused.',
  window_blur: 'Keep the challenge window active to avoid behavior penalties.',
  camera_off: 'Keep camera permissions enabled during the full attempt.',
  microphone_off: 'Keep microphone permissions enabled during the full attempt.',
  audio_off: 'Enable browser audio support before starting the session.',
  looking_away: 'Practice maintaining screen focus and reading prompts steadily.',
  multiple_faces: 'Make sure only you are visible in the camera frame.',
  no_face: 'Keep your face visible to the camera while coding.',
  speech_detected: 'Practice solving challenges in a quiet environment.',
  multiple_voices: 'Use a private room to prevent voice-related flags.',
  copy_paste: 'Practice writing core logic manually instead of copy/paste.',
};

export class SubmissionService {
  async createSubmission(userId: string, data: SubmissionInput) {
    const language = normalizeLanguage(data.language);

    if (data.session_id) {
      const sessionResult = await query(
        `SELECT status, pause_reason, deadline_at
         FROM proctoring_sessions
         WHERE id = $1 AND user_id = $2`,
        [data.session_id, userId],
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid proctoring session');
      }

      const sessionStatus = sessionResult.rows[0].status;
      if (sessionStatus === 'paused') {
        const reason =
          sessionResult.rows[0].pause_reason || 'Required proctoring checks are not satisfied';
        throw new Error(`Session is paused. ${reason}. Re-enable required devices to continue.`);
      }

      if (sessionStatus === 'completed') {
        throw new Error('Proctoring session already completed');
      }

      const deadlineRaw = sessionResult.rows[0].deadline_at;
      if (deadlineRaw) {
        const deadlineAt = new Date(deadlineRaw).getTime();
        const graceMs = 15 * 60 * 1000;
        if (Date.now() > deadlineAt + graceMs) {
          throw new Error(
            'Submission deadline exceeded. The 15-minute reconnect grace window has ended.',
          );
        }
      }
    }

    const challengeResult = await query(
      `SELECT id, publish_status
       FROM challenges
       WHERE id = $1`,
      [data.challenge_id],
    );
    if (challengeResult.rows.length === 0) {
      throw new Error('Challenge not found');
    }
    if (challengeResult.rows[0].publish_status !== 'published') {
      throw new Error('Challenge is not published');
    }

    const isReady = await judgeService.isChallengeReadyForLanguage(data.challenge_id, language);
    if (strictRealScoring && !isReady) {
      throw new Error(
        `Challenge scoring is not configured for ${language}. Admin must add tests and baseline first.`,
      );
    }

    if (!enableJudge && strictRealScoring) {
      throw new Error('Judge service is unavailable. Submission cannot be scored right now.');
    }

    const result = await query(
      `INSERT INTO submissions
         (user_id, challenge_id, session_id, code, language, status, judge_status)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'queued')
       RETURNING id, user_id, challenge_id, code, language, status, judge_status, submitted_at`,
      [userId, data.challenge_id, data.session_id ?? null, data.code, language],
    );

    const submission = result.rows[0];

    try {
      await query(`UPDATE proctoring_logs SET submission_id = $1 WHERE session_id = $2`, [
        submission.id,
        data.session_id,
      ]);
    } catch {
      // ignore optional relation failures
    }

    if (enableJudge) {
      try {
        const enqueueTimeoutMs = Number(process.env.JUDGE_QUEUE_ADD_TIMEOUT_MS ?? 8000);
        await Promise.race([
          judgeQueue.add(
            'judge.run',
            {
              submissionId: submission.id,
              challengeId: data.challenge_id,
              userId,
              code: data.code,
              language,
              sessionId: data.session_id ?? null,
            },
            defaultJobOptions,
          ),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Judge queue enqueue timeout')), enqueueTimeoutMs);
          }),
        ]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to enqueue submission for judge';
        await query(
          `UPDATE submissions
           SET judge_status = 'failed',
               status = 'failed',
               judge_error = $2
           WHERE id = $1`,
          [submission.id, message],
        );
        throw new Error('Submission queued failed. Please retry.');
      }
    }

    return {
      submission_id: submission.id,
      status: submission.status,
      judge_status: submission.judge_status,
      message: enableJudge
        ? 'Submission received and queued for scoring'
        : 'Submission stored (judge disabled)',
    };
  }

  async getSubmissionById(submissionId: string, userId: string) {
    await scoringService.ensureScoringSchemaExtensions();

    const result = await query(
      `SELECT s.id, s.user_id, s.challenge_id, s.session_id, s.code, s.language, s.score, s.status,
              s.judge_status, s.judge_error, s.judge_run_id, s.submitted_at,
              s.component_correctness, s.component_efficiency, s.component_style,
              s.component_skill, s.component_behavior, s.component_work_experience, s.component_penalty, s.scoring_version,
              c.title AS challenge_title,
              ts.total_score, ts.trust_level
       FROM submissions s
       JOIN challenges c ON s.challenge_id = c.id
       LEFT JOIN trust_scores ts ON s.user_id = ts.user_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [submissionId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error('Submission not found');
    }

    const submission = result.rows[0];

    const [logsResult, runSummaryResult] = await Promise.all([
      query(
        `SELECT violation_type, penalty, timestamp
         FROM proctoring_logs
         WHERE submission_id = $1
         ORDER BY timestamp`,
        [submissionId],
      ),
      query(
        `SELECT id, status, score_correctness, score_efficiency, score_style,
                test_passed, test_total, runtime_ms, memory_mb, started_at, finished_at, error_message
         FROM submission_runs
         WHERE submission_id = $1
         ORDER BY started_at DESC
         LIMIT 1`,
        [submissionId],
      ),
    ]);

    const violations = logsResult.rows.map((log) => ({
      type: log.violation_type,
      penalty: log.penalty,
      timestamp: log.timestamp,
    }));

    const violationPenaltyTotal = violations.reduce(
      (sum, violation) => sum + Number(violation.penalty ?? 0),
      0,
    );
    const storedPenalty = Number(submission.component_penalty ?? 0);
    const totalPenalty = Math.max(storedPenalty, violationPenaltyTotal);

    const latestRun = runSummaryResult.rows[0];
    const testsSummary = latestRun
      ? {
          passed: Number(latestRun.test_passed ?? 0),
          total: Number(latestRun.test_total ?? 0),
          runtime_ms: Number(latestRun.runtime_ms ?? 0),
          memory_mb: Number(latestRun.memory_mb ?? 0),
        }
      : null;

    const practiceFeedback = new Set<string>();
    if (submission.judge_status === 'failed') {
      practiceFeedback.add(
        submission.judge_error
          ? `Judge infrastructure error: ${submission.judge_error}. Retry this challenge.`
          : 'Judge infrastructure failed for this run. Retry this challenge.',
      );
    }

    if (latestRun?.id) {
      const failedTestsResult = await query(
        `SELECT COALESCE(tc.name, rt.test_case_id::text) as test_name
         FROM submission_run_tests rt
         LEFT JOIN challenge_test_cases tc ON tc.id = rt.test_case_id
         WHERE rt.submission_run_id = $1
           AND rt.status IN ('failed', 'error')
         ORDER BY rt.id
         LIMIT 3`,
        [latestRun.id],
      );
      for (const row of failedTestsResult.rows) {
        practiceFeedback.add(
          `Revisit failed test case: ${row.test_name}. Focus on edge cases and input handling.`,
        );
      }
    }

    const correctness = Number(submission.component_correctness ?? 0);
    const efficiency = Number(submission.component_efficiency ?? 0);
    const style = Number(submission.component_style ?? 0);
    if (correctness < 24) {
      practiceFeedback.add(
        'Improve correctness: validate edge cases and compare output formatting exactly.',
      );
    }
    if (efficiency < 8) {
      practiceFeedback.add(
        'Improve efficiency: use lower-complexity loops/data structures and avoid repeated work.',
      );
    }
    if (style < 3) {
      practiceFeedback.add(
        'Improve code style: use clear naming, small functions, and consistent formatting.',
      );
    }

    for (const violation of violations) {
      const mapped = PRACTICE_GUIDANCE_BY_VIOLATION[violation.type];
      if (mapped) {
        practiceFeedback.add(mapped);
      }
    }

    if (practiceFeedback.size === 0 && submission.status === 'graded') {
      practiceFeedback.add(
        'Strong attempt. Practice a harder challenge in the same category to raise your trust score.',
      );
    }

    return {
      submission_id: submission.id,
      challenge_id: submission.challenge_id,
      challenge_title: submission.challenge_title,
      language: submission.language,
      status: submission.status,
      judge_status: submission.judge_status,
      judge_error: submission.judge_error,
      judge_run_id: submission.judge_run_id,
      submitted_at: submission.submitted_at,
      score: submission.score,
      score_breakdown: {
        components: {
          correctness: Number(submission.component_correctness ?? 0),
          efficiency: Number(submission.component_efficiency ?? 0),
          style: Number(submission.component_style ?? 0),
          skill: Number(submission.component_skill ?? 0),
          behavior: Number(submission.component_behavior ?? 0),
          work_experience: Number(submission.component_work_experience ?? 0),
        },
        penalty: totalPenalty,
        scoring_version: submission.scoring_version ?? 'v3.0',
      },
      penalties: {
        total: totalPenalty,
        violation_count: violations.length,
      },
      run_summary: latestRun
        ? {
            run_id: latestRun.id,
            status: latestRun.status,
            error_message: latestRun.error_message,
            started_at: latestRun.started_at,
            finished_at: latestRun.finished_at,
          }
        : null,
      tests_summary: testsSummary,
      total_score: submission.total_score,
      trust_level: submission.trust_level,
      violations,
      practice_feedback: [...practiceFeedback].slice(0, 8),
    };
  }

  async getUserSubmissions(userId: string) {
    const result = await query(
      `SELECT s.id, s.challenge_id, c.title, s.language, s.score, s.status, s.judge_status, s.submitted_at
       FROM submissions s
       JOIN challenges c ON s.challenge_id = c.id
       WHERE s.user_id = $1
       ORDER BY s.submitted_at DESC`,
      [userId],
    );

    return result.rows.map((sub) => ({
      submission_id: sub.id,
      challenge_id: sub.challenge_id,
      challenge_title: sub.title,
      language: sub.language,
      score: sub.score,
      status: sub.status,
      judge_status: sub.judge_status,
      submitted_at: sub.submitted_at,
    }));
  }

  async getSubmissionRuns(submissionId: string, userId: string) {
    const ownership = await query(`SELECT id FROM submissions WHERE id = $1 AND user_id = $2`, [
      submissionId,
      userId,
    ]);
    if (ownership.rows.length === 0) throw new Error('Submission not found');

    const runs = await submissionRunService.listBySubmission(submissionId);
    return runs.map((run) => ({
      run_id: run.id,
      submission_id: run.submission_id,
      language: run.language,
      status: run.status,
      score_correctness: Number(run.score_correctness ?? 0),
      score_efficiency: Number(run.score_efficiency ?? 0),
      score_style: Number(run.score_style ?? 0),
      test_passed: Number(run.test_passed ?? 0),
      test_total: Number(run.test_total ?? 0),
      runtime_ms: Number(run.runtime_ms ?? 0),
      memory_mb: Number(run.memory_mb ?? 0),
      started_at: run.started_at,
      finished_at: run.finished_at,
      error_message: run.error_message,
    }));
  }

  async getSubmissionRunDetails(
    submissionId: string,
    runId: string,
    userId: string,
  ) {
    const ownership = await query(`SELECT id FROM submissions WHERE id = $1 AND user_id = $2`, [
      submissionId,
      userId,
    ]);
    if (ownership.rows.length === 0) throw new Error('Submission not found');

    const details = await submissionRunService.getRunDetails(runId, submissionId);
    if (!details) throw new Error('Run not found');

    return {
      run_id: details.id,
      submission_id: details.submission_id,
      language: details.language,
      status: details.status,
      score_correctness: Number(details.score_correctness ?? 0),
      score_efficiency: Number(details.score_efficiency ?? 0),
      score_style: Number(details.score_style ?? 0),
      test_passed: Number(details.test_passed ?? 0),
      test_total: Number(details.test_total ?? 0),
      runtime_ms: Number(details.runtime_ms ?? 0),
      memory_mb: Number(details.memory_mb ?? 0),
      started_at: details.started_at,
      finished_at: details.finished_at,
      error_message: details.error_message,
      tests: details.tests.map((test: any) => ({
        run_test_id: test.id,
        test_case_id: test.test_case_id,
        status: test.status,
        runtime_ms: Number(test.runtime_ms ?? 0),
        output: test.output,
        error: test.error,
        points_awarded: Number(test.points_awarded ?? 0),
      })),
    };
  }
}
