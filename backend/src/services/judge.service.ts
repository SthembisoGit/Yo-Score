import { query } from '../db';
import { enableJudge } from '../config';
import { runnerService, type RunnerLanguage } from './runner.service';

export interface JudgeRunTestResult {
  testCaseId: string;
  status: 'passed' | 'failed' | 'error';
  runtimeMs: number;
  output: string;
  error?: string;
  pointsAwarded: number;
}

export interface JudgeRunSummary {
  correctness: number;
  efficiency: number;
  style: number;
  testPassed: number;
  testTotal: number;
  runtimeMs: number;
  memoryMb: number;
}

export interface JudgeRunResult {
  summary: JudgeRunSummary;
  tests: JudgeRunTestResult[];
  infrastructureError: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeLanguage(language: string): 'javascript' | 'python' {
  const lower = language.toLowerCase();
  if (lower === 'python' || lower === 'py') return 'python';
  return 'javascript';
}

function runnerLanguage(language: string): RunnerLanguage {
  return normalizeLanguage(language) === 'python' ? 'python' : 'node';
}

function computeStyleScore(language: 'javascript' | 'python', code: string): number {
  const trimmed = code.trim();
  if (!trimmed.length) return 0;

  let score = 5;

  const todoPattern = /todo|fixme|placeholder|write your solution here|implement me/i;
  if (todoPattern.test(trimmed)) score -= 2;

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const veryLongLines = lines.filter((line) => line.length > 120).length;
  if (veryLongLines > 0) score -= 1;
  if (veryLongLines > 5) score -= 1;

  if (language === 'javascript') {
    const hasFunction = /\bfunction\b|=>/.test(trimmed);
    if (!hasFunction) score -= 1;
    const excessiveConsole = (trimmed.match(/console\.log/g) ?? []).length > 3;
    if (excessiveConsole) score -= 1;
  } else {
    const hasFunction = /\bdef\s+\w+\s*\(/.test(trimmed);
    if (!hasFunction) score -= 1;
    const excessivePrint = (trimmed.match(/\bprint\s*\(/g) ?? []).length > 3;
    if (excessivePrint) score -= 1;
  }

  return clamp(score, 0, 5);
}

function detectInfrastructureError(tests: JudgeRunTestResult[]): string | null {
  if (tests.length === 0) return 'No tests executed';
  const allError = tests.every((test) => test.status === 'error');
  if (!allError) return null;

  const infraIndicators = [
    'docker',
    'cannot connect to the docker daemon',
    'is not recognized as an internal or external command',
    'permission denied',
    'context canceled',
  ];

  const infraMatch = tests.every((test) => {
    const message = String(test.error ?? '').toLowerCase();
    return infraIndicators.some((indicator) => message.includes(indicator));
  });

  if (!infraMatch) return null;
  return 'Judge infrastructure unavailable (Docker/runner).';
}

export class JudgeService {
  async hasBaseline(challengeId: string, language: string): Promise<boolean> {
    const normalizedLanguage = normalizeLanguage(language);
    const result = await query(
      `SELECT 1 FROM challenge_baselines WHERE challenge_id = $1 AND language = $2 LIMIT 1`,
      [challengeId, normalizedLanguage],
    );
    return result.rows.length > 0;
  }

  async hasTestCases(challengeId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM challenge_test_cases WHERE challenge_id = $1 LIMIT 1`,
      [challengeId],
    );
    return result.rows.length > 0;
  }

  async isChallengeReadyForLanguage(challengeId: string, language: string): Promise<boolean> {
    const [hasTests, hasBaseline] = await Promise.all([
      this.hasTestCases(challengeId),
      this.hasBaseline(challengeId, language),
    ]);
    return hasTests && hasBaseline;
  }

  async runTests(challengeId: string, language: string, code: string): Promise<JudgeRunResult | null> {
    if (!enableJudge) return null;

    const normalizedLanguage = normalizeLanguage(language);
    const testsResult = await query(
      `SELECT id, input, expected_output, timeout_ms, memory_mb, points
       FROM challenge_test_cases
       WHERE challenge_id = $1
       ORDER BY order_index, created_at`,
      [challengeId],
    );
    if (testsResult.rows.length === 0) return null;

    const baselineResult = await query(
      `SELECT runtime_ms
       FROM challenge_baselines
       WHERE challenge_id = $1 AND language = $2
       LIMIT 1`,
      [challengeId, normalizedLanguage],
    );
    if (baselineResult.rows.length === 0) return null;

    const targetRuntime = Math.max(1, Number(baselineResult.rows[0].runtime_ms ?? 2000));

    const tests = testsResult.rows.map((row: any) => ({
      id: row.id,
      input: row.input,
      expected_output: row.expected_output,
      timeout_ms: Number(row.timeout_ms ?? 5000),
      memory_mb: Number(row.memory_mb ?? 256),
      points: Number(row.points ?? 1),
    }));

    const run = await runnerService.runCode(runnerLanguage(normalizedLanguage), code, tests);

    const detailedTests: JudgeRunTestResult[] = run.testResults.map((result) => ({
      testCaseId: result.id,
      status: result.status,
      runtimeMs: result.runtime_ms,
      output: result.output,
      error: result.error,
      pointsAwarded: result.points_awarded,
    }));

    const totalPoints = tests.reduce((sum, test) => sum + test.points, 0) || 1;
    const earnedPoints = detailedTests.reduce((sum, test) => sum + test.pointsAwarded, 0);
    const correctness = clamp(Math.round((earnedPoints / totalPoints) * 40), 0, 40);

    const avgRuntime =
      detailedTests.reduce((sum, test) => sum + Number(test.runtimeMs || 0), 0) /
      Math.max(detailedTests.length, 1);
    const runtimeRatio = Math.min(2, avgRuntime / targetRuntime);
    const efficiency = clamp(Math.round(15 * (2 - runtimeRatio)), 0, 15);

    const style = computeStyleScore(normalizedLanguage, code);

    return {
      summary: {
        correctness,
        efficiency,
        style,
        testPassed: detailedTests.filter((test) => test.status === 'passed').length,
        testTotal: detailedTests.length,
        runtimeMs: run.runtime_ms,
        memoryMb: run.memory_mb,
      },
      tests: detailedTests,
      infrastructureError: detectInfrastructureError(detailedTests),
    };
  }
}

export const judgeService = new JudgeService();
