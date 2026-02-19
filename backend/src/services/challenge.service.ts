import { query } from '../db';
import {
  getFallbackBands,
  getSeniorityBandFromMonths,
  type SeniorityBand,
} from '../utils/seniority';

export type ChallengePublishStatus = 'draft' | 'published' | 'archived';

export interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  target_seniority: SeniorityBand;
  duration_minutes: number;
  publish_status: ChallengePublishStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateChallengeInput {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  target_seniority?: SeniorityBand;
  duration_minutes?: number;
  publish_status?: ChallengePublishStatus;
}

export interface UpdateChallengeInput {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  target_seniority?: SeniorityBand;
  duration_minutes?: number;
}

export interface ChallengeReadiness {
  challenge_id: string;
  has_tests: boolean;
  baseline_languages: string[];
  missing_languages: string[];
  is_ready: boolean;
}

type GetChallengeOptions = {
  includeUnpublished?: boolean;
  readyOnly?: boolean;
};

export class ChallengeService {
  private isMissingSchemaError(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    const message = (error as { message?: string })?.message ?? '';
    return code === '42703' || code === '42P01' || /does not exist/i.test(message);
  }

  private getReadinessSql(alias = ''): string {
    const prefix = alias ? `${alias}.` : '';
    return `EXISTS (
              SELECT 1
              FROM challenge_test_cases t
              WHERE t.challenge_id = ${prefix}id
            )
            AND EXISTS (
              SELECT 1
              FROM challenge_baselines b_js
              WHERE b_js.challenge_id = ${prefix}id
                AND b_js.language = 'javascript'
            )
            AND EXISTS (
              SELECT 1
              FROM challenge_baselines b_py
              WHERE b_py.challenge_id = ${prefix}id
                AND b_py.language = 'python'
            )`;
  }

  private async getAllChallengesLegacy(options: GetChallengeOptions = {}) {
    const readyOnly = options.readyOnly ?? false;
    const where = readyOnly ? `WHERE ${this.getReadinessSql('c')}` : '';
    const result = await query(
      `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.created_at, c.updated_at
       FROM challenges c
       ${where}
       ORDER BY c.created_at DESC`,
    );

    return result.rows.map((challenge) => this.mapRowToChallenge(challenge));
  }

  async getAllChallenges(options: GetChallengeOptions = {}) {
    const includeUnpublished = options.includeUnpublished ?? false;
    const readyOnly = options.readyOnly ?? false;
    const conditions: string[] = [];
    if (!includeUnpublished) {
      conditions.push(`c.publish_status = 'published'`);
    }
    if (readyOnly) {
      conditions.push(this.getReadinessSql('c'));
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const result = await query(
        `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.target_seniority, c.duration_minutes, c.publish_status, c.created_at, c.updated_at
         FROM challenges c
         ${where}
         ORDER BY c.created_at DESC`,
      );

      return result.rows.map((challenge) => this.mapRowToChallenge(challenge));
    } catch (error) {
      if (this.isMissingSchemaError(error)) {
        return this.getAllChallengesLegacy(options);
      }
      throw error;
    }
  }

  async getChallengeById(challengeId: string, options: GetChallengeOptions = {}) {
    const includeUnpublished = options.includeUnpublished ?? false;
    const readyOnly = options.readyOnly ?? false;
    const conditions = [`c.id = $1`];
    if (!includeUnpublished) {
      conditions.push(`c.publish_status = 'published'`);
    }
    if (readyOnly) {
      conditions.push(this.getReadinessSql('c'));
    }

    try {
      const result = await query(
        `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.target_seniority, c.duration_minutes, c.publish_status, c.created_at, c.updated_at
         FROM challenges c
         WHERE ${conditions.join(' AND ')}`,
        [challengeId],
      );

      if (result.rows.length === 0) {
        throw new Error('Challenge not found');
      }

      return this.mapRowToChallenge(result.rows[0]);
    } catch (error) {
      if (!this.isMissingSchemaError(error)) {
        throw error;
      }

      const legacyConditions = [`c.id = $1`];
      if (readyOnly) {
        legacyConditions.push(this.getReadinessSql('c'));
      }
      const legacyResult = await query(
        `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.created_at, c.updated_at
         FROM challenges c
         WHERE ${legacyConditions.join(' AND ')}`,
        [challengeId],
      );
      if (legacyResult.rows.length === 0) {
        throw new Error('Challenge not found');
      }
      return this.mapRowToChallenge(legacyResult.rows[0]);
    }
  }

  private async getTrustedExperienceMonths(userId: string): Promise<number> {
    try {
      const result = await query(
        `SELECT COALESCE(SUM(duration_months), 0) as total
         FROM work_experience
         WHERE user_id = $1
           AND verification_status IN ('pending', 'verified')
           AND COALESCE(risk_score, 0) <= 60`,
        [userId],
      );
      return Number(result.rows[0]?.total ?? 0);
    } catch {
      const fallback = await query(
        `SELECT COALESCE(SUM(duration_months), 0) as total
         FROM work_experience
         WHERE user_id = $1`,
        [userId],
      );
      return Number(fallback.rows[0]?.total ?? 0);
    }
  }

  async getNextChallengeForUser(userId: string, category?: string) {
    const trustedMonths = await this.getTrustedExperienceMonths(userId);
    const userBand = getSeniorityBandFromMonths(trustedMonths);
    const fallbackBands = getFallbackBands(userBand);

    const params: unknown[] = [userId, fallbackBands];
    const categoryFilter = category ? `AND LOWER(c.category) = LOWER($3)` : '';
    if (category) params.push(category);

    try {
      const result = await query(
        `SELECT c.id, c.title, c.description, c.category, c.difficulty,
                c.target_seniority, c.duration_minutes, c.publish_status, c.created_at, c.updated_at
         FROM challenges c
         WHERE c.publish_status = 'published'
           AND c.target_seniority = ANY($2::text[])
           AND ${this.getReadinessSql('c')}
           ${categoryFilter}
           AND NOT EXISTS (
             SELECT 1
             FROM submissions s
             WHERE s.challenge_id = c.id
               AND s.user_id = $1
               AND s.status = 'graded'
           )
         ORDER BY array_position($2::text[], c.target_seniority), RANDOM()
         LIMIT 1`,
        params,
      );

      if (result.rows.length === 0) {
        throw new Error('No challenges available');
      }
      return this.mapRowToChallenge(result.rows[0]);
    } catch (error) {
      if (!this.isMissingSchemaError(error)) {
        throw error;
      }

      const legacyParams: unknown[] = [userId];
      const legacyCategoryFilter = category ? `AND LOWER(c.category) = LOWER($2)` : '';
      if (category) legacyParams.push(category);

      const legacyResult = await query(
        `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.created_at, c.updated_at
         FROM challenges c
         WHERE ${this.getReadinessSql('c')}
           ${legacyCategoryFilter}
           AND NOT EXISTS (
             SELECT 1
             FROM submissions s
             WHERE s.challenge_id = c.id
               AND s.user_id = $1
               AND s.status = 'graded'
           )
         ORDER BY RANDOM()
         LIMIT 1`,
        legacyParams,
      );

      if (legacyResult.rows.length === 0) {
        throw new Error('No challenges available');
      }
      return this.mapRowToChallenge(legacyResult.rows[0]);
    }
  }

  async createChallenge(data: CreateChallengeInput) {
    const result = await query(
      `INSERT INTO challenges
         (title, description, category, difficulty, target_seniority, duration_minutes, publish_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, description, category, difficulty, target_seniority, duration_minutes, publish_status, created_at, updated_at`,
      [
        data.title,
        data.description,
        data.category,
        data.difficulty,
        data.target_seniority ?? 'junior',
        data.duration_minutes ?? 45,
        data.publish_status ?? 'draft',
      ],
    );

    return this.mapRowToChallenge(result.rows[0]);
  }

  async updateChallenge(challengeId: string, data: UpdateChallengeInput) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (typeof data.title === 'string') {
      updates.push(`title = $${idx++}`);
      values.push(data.title);
    }
    if (typeof data.description === 'string') {
      updates.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (typeof data.category === 'string') {
      updates.push(`category = $${idx++}`);
      values.push(data.category);
    }
    if (typeof data.difficulty === 'string') {
      updates.push(`difficulty = $${idx++}`);
      values.push(data.difficulty);
    }
    if (typeof data.target_seniority === 'string') {
      updates.push(`target_seniority = $${idx++}`);
      values.push(data.target_seniority);
    }
    if (typeof data.duration_minutes === 'number') {
      updates.push(`duration_minutes = $${idx++}`);
      values.push(data.duration_minutes);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = NOW()');
    values.push(challengeId);

    const result = await query(
      `UPDATE challenges
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, title, description, category, difficulty, target_seniority, duration_minutes, publish_status, created_at, updated_at`,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error('Challenge not found');
    }
    return this.mapRowToChallenge(result.rows[0]);
  }

  async setPublishStatus(challengeId: string, status: ChallengePublishStatus) {
    if (status === 'published') {
      const readiness = await this.getChallengeReadiness(challengeId);
      if (!readiness.is_ready) {
        throw new Error(
          `Challenge is not publish-ready. Missing: ${readiness.missing_languages.join(', ') || 'tests'}`,
        );
      }
    }

    const result = await query(
      `UPDATE challenges
       SET publish_status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, category, difficulty, publish_status, created_at, updated_at`,
      [challengeId, status],
    );

    if (result.rows.length === 0) {
      throw new Error('Challenge not found');
    }
    return this.mapRowToChallenge(result.rows[0]);
  }

  async getChallengeReadiness(challengeId: string): Promise<ChallengeReadiness> {
    const [testsResult, baselinesResult] = await Promise.all([
      query(`SELECT COUNT(*)::int as count FROM challenge_test_cases WHERE challenge_id = $1`, [challengeId]),
      query(
        `SELECT language
         FROM challenge_baselines
         WHERE challenge_id = $1`,
        [challengeId],
      ),
    ]);

    const hasTests = Number(testsResult.rows[0]?.count ?? 0) > 0;
    const baselineLanguages = baselinesResult.rows
      .map((row) => String(row.language).toLowerCase())
      .filter((value, index, arr) => arr.indexOf(value) === index);
    const required = ['javascript', 'python'];
    const missingLanguages = required.filter((lang) => !baselineLanguages.includes(lang));

    return {
      challenge_id: challengeId,
      has_tests: hasTests,
      baseline_languages: baselineLanguages,
      missing_languages: missingLanguages,
      is_ready: hasTests && missingLanguages.length === 0,
    };
  }

  private mapRowToChallenge(row: Record<string, unknown>): Challenge {
    return {
      challenge_id: String(row.id),
      title: String(row.title),
      description: String(row.description),
      category: String(row.category),
      difficulty: String(row.difficulty),
      target_seniority: (String(row.target_seniority ?? 'junior') as SeniorityBand),
      duration_minutes: Number(row.duration_minutes ?? 45),
      publish_status: (row.publish_status as ChallengePublishStatus) ?? 'published',
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}

export const challengeService = new ChallengeService();
