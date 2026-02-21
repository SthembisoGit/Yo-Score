import { query } from '../db';
import { normalizeLanguage, type SupportedLanguage } from '../constants/languages';

export interface TestCaseInput {
  name: string;
  input: string;
  expected_output: string;
  is_hidden?: boolean;
  points?: number;
  timeout_ms?: number;
  memory_mb?: number;
  order_index?: number;
}

export interface BaselineInput {
  language: string;
  runtime_ms?: number;
  memory_mb?: number;
  lint_rules?: Record<string, unknown>;
}

export class ChallengeTestsService {
  private normalizeLanguage(language: string): SupportedLanguage {
    return normalizeLanguage(language);
  }

  async listTestCases(challengeId: string) {
    const result = await query(
      `SELECT id, name, input, expected_output, is_hidden, points, timeout_ms, memory_mb, order_index, created_at, updated_at
       FROM challenge_test_cases
       WHERE challenge_id = $1
       ORDER BY order_index, created_at`,
      [challengeId],
    );
    return result.rows;
  }

  async upsertTestCase(challengeId: string, testId: string | null, data: TestCaseInput) {
    if (testId) {
      const result = await query(
        `UPDATE challenge_test_cases
           SET name = $2,
               input = $3,
               expected_output = $4,
               is_hidden = COALESCE($5, is_hidden),
               points = COALESCE($6, points),
               timeout_ms = COALESCE($7, timeout_ms),
               memory_mb = COALESCE($8, memory_mb),
               order_index = COALESCE($9, order_index),
               updated_at = NOW()
         WHERE id = $1 AND challenge_id = $10
         RETURNING *`,
        [
          testId,
          data.name,
          data.input,
          data.expected_output,
          data.is_hidden ?? null,
          data.points ?? null,
          data.timeout_ms ?? null,
          data.memory_mb ?? null,
          data.order_index ?? null,
          challengeId,
        ],
      );
      if (result.rows.length === 0) throw new Error('Test case not found');
      return result.rows[0];
    }

    const result = await query(
      `INSERT INTO challenge_test_cases
         (challenge_id, name, input, expected_output, is_hidden, points, timeout_ms, memory_mb, order_index)
       VALUES ($1, $2, $3, $4, COALESCE($5,false), COALESCE($6,1), COALESCE($7,5000), COALESCE($8,256), COALESCE($9,0))
       RETURNING *`,
      [
        challengeId,
        data.name,
        data.input,
        data.expected_output,
        data.is_hidden ?? false,
        data.points ?? 1,
        data.timeout_ms ?? 5000,
        data.memory_mb ?? 256,
        data.order_index ?? 0,
      ],
    );
    return result.rows[0];
  }

  async deleteTestCase(challengeId: string, testId: string) {
    await query(
      `DELETE FROM challenge_test_cases WHERE id = $1 AND challenge_id = $2`,
      [testId, challengeId],
    );
  }

  async getBaseline(challengeId: string, language: string) {
    const normalized = this.normalizeLanguage(language);
    const result = await query(
      `SELECT id, language, runtime_ms, memory_mb, lint_rules, updated_at
       FROM challenge_baselines
       WHERE challenge_id = $1 AND language = $2`,
      [challengeId, normalized],
    );
    return result.rows[0] || null;
  }

  async upsertBaseline(challengeId: string, data: BaselineInput) {
    const normalized = this.normalizeLanguage(data.language);
    const result = await query(
      `INSERT INTO challenge_baselines (challenge_id, language, runtime_ms, memory_mb, lint_rules, updated_at)
       VALUES ($1, $2, COALESCE($3, 5000), COALESCE($4, 256), COALESCE($5, '{}'::jsonb), NOW())
       ON CONFLICT (challenge_id, language) DO UPDATE
         SET runtime_ms = COALESCE($3, EXCLUDED.runtime_ms),
             memory_mb = COALESCE($4, EXCLUDED.memory_mb),
             lint_rules = COALESCE($5, EXCLUDED.lint_rules),
             updated_at = NOW()
       RETURNING *`,
      [
        challengeId,
        normalized,
        data.runtime_ms ?? 5000,
        data.memory_mb ?? 256,
        data.lint_rules ?? {},
      ],
    );
    return result.rows[0];
  }
}

export const challengeTestsService = new ChallengeTestsService();
