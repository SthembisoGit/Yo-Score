import type { Job } from 'bullmq';
import { createJudgeWorker, JudgeJobData } from './queue/judgeQueue';
import { judgeService } from './services/judge.service';
import { submissionRunService } from './services/submissionRun.service';
import { scoringService } from './services/scoring.service';
import { query } from './db';
import { normalizeLanguage } from './constants/languages';
import { logger } from './utils/logger';

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

const processor = async (job: Job<JudgeJobData>) => {
  const { submissionId, challengeId, userId, code, language, sessionId } = job.data;
  let runId: string | null = null;

  try {
    const normalizedLanguage = normalizeLanguage(language);

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

    runId = await submissionRunService.create({
      submissionId,
      language: normalizedLanguage,
      status: 'running',
    });

    await query(`UPDATE submissions SET judge_run_id = $2 WHERE id = $1`, [submissionId, runId]);

    if (!runId) {
      throw new Error('Failed to create submission run');
    }
    const ensuredRunId = runId;

    const runResult = await judgeService.runTests(challengeId, normalizedLanguage, code);
    if (!runResult) {
      await submissionRunService.complete({
        runId: ensuredRunId,
        status: 'failed',
        errorMessage: 'Judge cannot execute: missing tests or baseline.',
      });
      await markSubmissionFailed(
        submissionId,
        'Judge cannot execute: missing tests or baseline.',
        ensuredRunId,
      );
      return { submissionId };
    }

    if (runResult.infrastructureError) {
      await submissionRunService.complete({
        runId: ensuredRunId,
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
      await markSubmissionFailed(submissionId, runResult.infrastructureError, ensuredRunId);
      return { submissionId };
    }

    await submissionRunService.addTests(
      runResult.tests.map((test) => ({
        runId: ensuredRunId,
        testCaseId: test.testCaseId,
        status: test.status,
        runtimeMs: test.runtimeMs,
        output: test.output,
        error: test.error,
        pointsAwarded: test.pointsAwarded,
      })),
    );

    await submissionRunService.complete({
      runId: ensuredRunId,
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

    return { submissionId, runId: ensuredRunId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Judge worker failed unexpectedly';
    try {
      if (runId) {
        await submissionRunService.complete({
          runId,
          status: 'failed',
          errorMessage: message,
        });
      }
    } catch {
      // ignore run completion failure and still mark submission failed
    }
    await markSubmissionFailed(submissionId, message, runId ?? undefined);
    throw error;
  }
};

const judgeWorker = createJudgeWorker(processor);

if (judgeWorker) {
  judgeWorker.on('active', (job) => {
    logger.info('Judge worker job active', {
      jobId: job.id,
      submissionId: job.data?.submissionId ?? 'unknown',
    });
  });

  judgeWorker.on('completed', (job) => {
    logger.info('Judge worker job completed', {
      jobId: job.id,
      submissionId: job.data?.submissionId ?? 'unknown',
    });
  });

  judgeWorker.on('failed', (job, error) => {
    const submissionId = job?.data?.submissionId ?? 'unknown';
    const message = error instanceof Error ? error.message : 'Unknown worker failure';
    logger.error('Judge worker job failed', {
      jobId: job?.id ?? 'unknown',
      submissionId,
      message,
    });
  });

  judgeWorker.on('error', (error) => {
    const message = error instanceof Error ? error.message : 'Unknown worker error';
    logger.error('Judge worker runtime error', { message });
  });
}

logger.info('Judge worker started');
