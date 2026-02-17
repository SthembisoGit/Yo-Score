import { query } from '../db';

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export interface RunCreateInput {
  submissionId: string;
  language: string;
  status: RunStatus;
}

export interface RunCompletionInput {
  runId: string;
  status: RunStatus;
  scoreCorrectness?: number;
  scoreEfficiency?: number;
  scoreStyle?: number;
  testPassed?: number;
  testTotal?: number;
  runtimeMs?: number | null;
  memoryMb?: number | null;
  stdout?: string;
  stderr?: string;
  sandboxExitCode?: number | null;
  errorMessage?: string | null;
}

export interface RunTestInsertInput {
  runId: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'error';
  runtimeMs: number;
  output: string;
  error?: string;
  pointsAwarded: number;
}

export class SubmissionRunService {
  async create(run: RunCreateInput) {
    const result = await query(
      `INSERT INTO submission_runs
         (submission_id, language, status, started_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [run.submissionId, run.language, run.status],
    );
    return result.rows[0]?.id as string;
  }

  async complete(input: RunCompletionInput) {
    await query(
      `UPDATE submission_runs
       SET status = $2,
           score_correctness = $3,
           score_efficiency = $4,
           score_style = $5,
           test_passed = $6,
           test_total = $7,
           runtime_ms = $8,
           memory_mb = $9,
           stdout = CASE WHEN $10 IS NULL THEN NULL ELSE convert_to($10, 'UTF8') END,
           stderr = CASE WHEN $11 IS NULL THEN NULL ELSE convert_to($11, 'UTF8') END,
           sandbox_exit_code = $12,
           error_message = $13,
           finished_at = NOW()
       WHERE id = $1`,
      [
        input.runId,
        input.status,
        input.scoreCorrectness ?? 0,
        input.scoreEfficiency ?? 0,
        input.scoreStyle ?? 0,
        input.testPassed ?? 0,
        input.testTotal ?? 0,
        input.runtimeMs ?? null,
        input.memoryMb ?? null,
        input.stdout?.slice(0, 32000) ?? null,
        input.stderr?.slice(0, 32000) ?? null,
        input.sandboxExitCode ?? null,
        input.errorMessage ?? null,
      ],
    );
  }

  async addTests(inputs: RunTestInsertInput[]) {
    if (inputs.length === 0) return;
    for (const input of inputs) {
      await query(
        `INSERT INTO submission_run_tests
           (submission_run_id, test_case_id, status, runtime_ms, output, error, points_awarded)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.runId,
          input.testCaseId,
          input.status,
          input.runtimeMs,
          input.output.slice(0, 32000),
          (input.error ?? null)?.slice(0, 32000) ?? null,
          input.pointsAwarded,
        ],
      );
    }
  }

  async listBySubmission(submissionId: string) {
    const result = await query(
      `SELECT id, submission_id, language, status, score_correctness, score_efficiency, score_style,
              started_at, finished_at, runtime_ms, memory_mb, test_passed, test_total, error_message
       FROM submission_runs
       WHERE submission_id = $1
       ORDER BY started_at DESC`,
      [submissionId],
    );
    return result.rows;
  }

  async getRunDetails(runId: string, submissionId: string) {
    const runResult = await query(
      `SELECT id, submission_id, language, status, score_correctness, score_efficiency, score_style,
              started_at, finished_at, runtime_ms, memory_mb, test_passed, test_total, error_message
       FROM submission_runs
       WHERE id = $1 AND submission_id = $2`,
      [runId, submissionId],
    );
    if (runResult.rows.length === 0) return null;

    const testsResult = await query(
      `SELECT id, test_case_id, status, runtime_ms, output, error, points_awarded
       FROM submission_run_tests
       WHERE submission_run_id = $1
       ORDER BY id`,
      [runId],
    );

    return {
      ...runResult.rows[0],
      tests: testsResult.rows,
    };
  }
}

export const submissionRunService = new SubmissionRunService();
