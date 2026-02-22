import { query } from '../db';
import {
  getFallbackBands,
  getSeniorityBandFromMonths,
  type SeniorityBand,
} from '../utils/seniority';
import {
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../constants/languages';

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
  supported_languages: SupportedLanguage[];
  starter_templates: Record<SupportedLanguage, string>;
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
  supported_languages?: SupportedLanguage[];
}

export interface UpdateChallengeInput {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  target_seniority?: SeniorityBand;
  duration_minutes?: number;
  supported_languages?: SupportedLanguage[];
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
  private sanitizeDurationMinutes(rawDuration: unknown): number {
    let duration = Number(rawDuration ?? 45);
    if (!Number.isFinite(duration) || duration <= 0) {
      duration = 45;
    }
    // Legacy seed data sometimes stored seconds in duration_minutes.
    if (duration > 300) {
      duration = Math.round(duration / 60);
    }
    return Math.round(Math.min(300, Math.max(5, duration)));
  }

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
            AND ${SUPPORTED_LANGUAGES.map(
              (language, index) => `EXISTS (
              SELECT 1
              FROM challenge_baselines b_${index}
              WHERE b_${index}.challenge_id = ${prefix}id
                AND b_${index}.language = '${language}'
            )`,
            ).join('\n            AND ')}`;
  }

  private getDefaultStarterTemplate(language: SupportedLanguage): string {
    if (language === 'python') {
      return `def solve(input_data):
    # parse input_data and return result
    return input_data

if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`;
    }
    if (language === 'java') {
      return `import java.io.*;

public class Main {
    static String solve(String input) {
        // parse input and return output
        return input.trim();
    }

    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes());
        System.out.print(solve(input));
    }
}`;
    }
    if (language === 'cpp') {
      return `#include <bits/stdc++.h>
using namespace std;

string solve(const string& input) {
    // parse input and return output
    return input;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    cout << solve(input);
    return 0;
}`;
    }
    if (language === 'go') {
      return `package main

import (
    "fmt"
    "io"
    "os"
)

func solve(input string) string {
    // parse input and return output
    return input
}

func main() {
    data, _ := io.ReadAll(os.Stdin)
    fmt.Print(solve(string(data)))
}`;
    }
    if (language === 'csharp') {
      return `using System;
using System.IO;

public class Program
{
    static string Solve(string input)
    {
        // parse input and return output
        return input.Trim();
    }

    public static void Main()
    {
        string input = Console.In.ReadToEnd();
        Console.Write(Solve(input));
    }
}`;
    }
    return `function solve(input) {
  // parse input and return output
  return input.trim();
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');
process.stdout.write(String(solve(input)));`;
  }

  private normalizeSupportedLanguages(languages?: SupportedLanguage[]): SupportedLanguage[] {
    const normalized = (languages ?? SUPPORTED_LANGUAGES)
      .map((language) => normalizeLanguage(language))
      .filter((value, index, arr) => arr.indexOf(value) === index);

    return normalized.length > 0 ? normalized : [...SUPPORTED_LANGUAGES];
  }

  private buildStarterTemplates(
    supportedLanguages: SupportedLanguage[],
  ): Record<SupportedLanguage, string> {
    return SUPPORTED_LANGUAGES.reduce((acc, language) => {
      acc[language] = this.getDefaultStarterTemplate(language);
      return acc;
    }, {} as Record<SupportedLanguage, string>);
  }

  private async syncChallengeBaselinesForLanguages(
    challengeId: string,
    supportedLanguages?: SupportedLanguage[],
  ) {
    const normalizedLanguages = this.normalizeSupportedLanguages(supportedLanguages);
    await query(
      `DELETE FROM challenge_baselines
       WHERE challenge_id = $1
         AND language <> ALL($2::text[])`,
      [challengeId, normalizedLanguages],
    );

    for (const language of normalizedLanguages) {
      await query(
        `INSERT INTO challenge_baselines (challenge_id, language, runtime_ms, memory_mb, lint_rules, updated_at)
         VALUES ($1, $2, 2000, 256, '{}'::jsonb, NOW())
         ON CONFLICT (challenge_id, language) DO NOTHING`,
        [challengeId, language],
      );
    }
  }

  private async getAllChallengesLegacy(options: GetChallengeOptions = {}) {
    const readyOnly = options.readyOnly ?? false;
    const where = readyOnly ? `WHERE ${this.getReadinessSql('c')}` : '';
    const result = await query(
      `SELECT c.id, c.title, c.description, c.category, c.difficulty,
              COALESCE(array_agg(DISTINCT b.language) FILTER (WHERE b.language IS NOT NULL), '{}'::text[]) AS baseline_languages,
              c.created_at, c.updated_at
       FROM challenges c
       LEFT JOIN challenge_baselines b ON b.challenge_id = c.id
       ${where}
       GROUP BY c.id
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
        `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.target_seniority, c.duration_minutes, c.publish_status,
                COALESCE(array_agg(DISTINCT b.language) FILTER (WHERE b.language IS NOT NULL), '{}'::text[]) AS baseline_languages,
                c.created_at, c.updated_at
         FROM challenges c
         LEFT JOIN challenge_baselines b ON b.challenge_id = c.id
         ${where}
         GROUP BY c.id
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
        `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.target_seniority, c.duration_minutes, c.publish_status,
                COALESCE(array_agg(DISTINCT b.language) FILTER (WHERE b.language IS NOT NULL), '{}'::text[]) AS baseline_languages,
                c.created_at, c.updated_at
         FROM challenges c
         LEFT JOIN challenge_baselines b ON b.challenge_id = c.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY c.id`,
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
        `SELECT c.id, c.title, c.description, c.category, c.difficulty,
                COALESCE(array_agg(DISTINCT b.language) FILTER (WHERE b.language IS NOT NULL), '{}'::text[]) AS baseline_languages,
                c.created_at, c.updated_at
         FROM challenges c
         LEFT JOIN challenge_baselines b ON b.challenge_id = c.id
         WHERE ${legacyConditions.join(' AND ')}
         GROUP BY c.id`,
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
                c.target_seniority, c.duration_minutes, c.publish_status,
                COALESCE(array_agg(DISTINCT b.language) FILTER (WHERE b.language IS NOT NULL), '{}'::text[]) AS baseline_languages,
                c.created_at, c.updated_at
         FROM challenges c
         LEFT JOIN challenge_baselines b ON b.challenge_id = c.id
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
               AND s.submitted_at >= NOW() - INTERVAL '30 days'
           )
         GROUP BY c.id
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
        `SELECT c.id, c.title, c.description, c.category, c.difficulty,
                COALESCE(array_agg(DISTINCT b.language) FILTER (WHERE b.language IS NOT NULL), '{}'::text[]) AS baseline_languages,
                c.created_at, c.updated_at
         FROM challenges c
         LEFT JOIN challenge_baselines b ON b.challenge_id = c.id
         WHERE ${this.getReadinessSql('c')}
           ${legacyCategoryFilter}
           AND NOT EXISTS (
             SELECT 1
             FROM submissions s
             WHERE s.challenge_id = c.id
               AND s.user_id = $1
               AND s.status = 'graded'
               AND s.submitted_at >= NOW() - INTERVAL '30 days'
           )
         GROUP BY c.id
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

    const challenge = this.mapRowToChallenge({
      ...result.rows[0],
      baseline_languages: [],
    });
    await this.syncChallengeBaselinesForLanguages(challenge.challenge_id, data.supported_languages);
    return this.getChallengeById(challenge.challenge_id, { includeUnpublished: true });
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

    const shouldSyncLanguages = data.supported_languages !== undefined;

    if (updates.length === 0 && !shouldSyncLanguages) {
      throw new Error('No fields to update');
    }

    let updatedChallengeId = challengeId;
    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(challengeId);

      const result = await query(
        `UPDATE challenges
         SET ${updates.join(', ')}
         WHERE id = $${idx}
         RETURNING id`,
        values,
      );

      if (result.rows.length === 0) {
        throw new Error('Challenge not found');
      }
      updatedChallengeId = String(result.rows[0].id);
    }

    if (shouldSyncLanguages) {
      await this.syncChallengeBaselinesForLanguages(updatedChallengeId, data.supported_languages);
    }
    return this.getChallengeById(updatedChallengeId, { includeUnpublished: true });
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
      .map((row) => normalizeLanguage(String(row.language)))
      .filter((value, index, arr) => arr.indexOf(value) === index);
    const required = [...SUPPORTED_LANGUAGES];
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
    const baselineLanguages = Array.isArray(row.baseline_languages)
      ? (row.baseline_languages
          .map((language) => normalizeLanguage(String(language)))
          .filter((value, index, arr) => arr.indexOf(value) === index) as SupportedLanguage[])
      : [];
    const supportedLanguages =
      baselineLanguages.length > 0 ? baselineLanguages : [...SUPPORTED_LANGUAGES];

    return {
      challenge_id: String(row.id),
      title: String(row.title),
      description: String(row.description),
      category: String(row.category),
      difficulty: String(row.difficulty),
      target_seniority: (String(row.target_seniority ?? 'junior') as SeniorityBand),
      duration_minutes: this.sanitizeDurationMinutes(row.duration_minutes),
      publish_status: (row.publish_status as ChallengePublishStatus) ?? 'published',
      supported_languages: supportedLanguages,
      starter_templates: this.buildStarterTemplates(supportedLanguages),
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}

export const challengeService = new ChallengeService();
