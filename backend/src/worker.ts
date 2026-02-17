import { createJudgeWorker, JudgeJobData } from './queue/judgeQueue';
import { judgeService } from './services/judge.service';
import { submissionRunService } from './services/submissionRun.service';
import { scoringService } from './services/scoring.service';
import { query } from './db';

async function markSubmissionFailed(submissionId: string, error: string, runId?: string) {
  await query(
    `UPDATE submissions
     SET status = 'failed',
         judge_status = 'failed',
         judge_error = $2,
         judge_run_id = COALESCE($3, judge_run_id)
     WHERE id = $1`,
    [submissionId, error, runId ?? null],
  );
}

const processor = async (job: { data: JudgeJobData }) => {
  const { submissionId, challengeId, userId, code, language, sessionId } = job.data;

  const normalizedLanguage = language.toLowerCase() === 'python' ? 'python' : 'javascript';

  await query(
    `UPDATE submissions
     SET judge_status = 'running', judge_error = NULL
     WHERE id = $1`,
    [submissionId],
  );

  const isReady = await judgeService.isChallengeReadyForLanguage(challengeId, normalizedLanguage);
  if (!isReady) {
    await markSubmissionFailed(
      submissionId,
      'Challenge is not judge-ready for selected language. Configure tests and baseline first.',
    );
    return { submissionId };
  }

  const runId = await submissionRunService.create({
    submissionId,
    language: normalizedLanguage,
    status: 'running',
  });

  await query(`UPDATE submissions SET judge_run_id = $2 WHERE id = $1`, [submissionId, runId]);

  try {
    const runResult = await judgeService.runTests(challengeId, normalizedLanguage, code);
    if (!runResult) {
      await submissionRunService.complete({
        runId,
        status: 'failed',
        errorMessage: 'Judge cannot execute: missing tests or baseline.',
      });
      await markSubmissionFailed(submissionId, 'Judge cannot execute: missing tests or baseline.', runId);
      return { submissionId };
    }

    if (runResult.infrastructureError) {
      await submissionRunService.complete({
        runId,
        status: 'failed',
        scoreCorrectness: 0,
        scoreEfficiency: 0,
        scoreStyle: 0,
        testPassed: 0,
        testTotal: runResult.tests.length,
        runtimeMs: runResult.summary.runtimeMs,
        memoryMb: runResult.summary.memoryMb,
        errorMessage: runResult.infrastructureError,
      });
      await markSubmissionFailed(submissionId, runResult.infrastructureError, runId);
      return { submissionId };
    }

    await submissionRunService.addTests(
      runResult.tests.map((test) => ({
        runId,
        testCaseId: test.testCaseId,
        status: test.status,
        runtimeMs: test.runtimeMs,
        output: test.output,
        error: test.error,
        pointsAwarded: test.pointsAwarded,
      })),
    );

    await submissionRunService.complete({
      runId,
      status: 'completed',
      scoreCorrectness: runResult.summary.correctness,
      scoreEfficiency: runResult.summary.efficiency,
      scoreStyle: runResult.summary.style,
      testPassed: runResult.summary.testPassed,
      testTotal: runResult.summary.testTotal,
      runtimeMs: runResult.summary.runtimeMs,
      memoryMb: runResult.summary.memoryMb,
    });

    await scoringService.finalizeSubmissionScore(
      submissionId,
      userId,
      sessionId ?? null,
      {
        correctness: runResult.summary.correctness,
        efficiency: runResult.summary.efficiency,
        style: runResult.summary.style,
      },
    );

    return { submissionId, runId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Judge worker failed unexpectedly';
    await submissionRunService.complete({
      runId,
      status: 'failed',
      errorMessage: message,
    });
    await markSubmissionFailed(submissionId, message, runId);
    return { submissionId };
  }
};

createJudgeWorker(processor);

console.log('Judge worker started (async real scoring).');
