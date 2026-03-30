import { randomUUID } from 'crypto';

import { query } from '../db';
import { config } from '../config';
import { DashboardService } from './dashboard.service';

export interface ShareScoreSettings {
  enabled: boolean;
  token_present: boolean;
  public_url: string | null;
  updated_at: string | null;
}

export interface PublicShareScoreData {
  name: string;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  total_score: number;
  trust_level: string;
  seniority_band: 'graduate' | 'junior' | 'mid' | 'senior';
  monthly_progress: number;
  category_scores: Record<string, number>;
  top_recent_results: Array<{
    challenge_title: string;
    category: string;
    language: string;
    score: number;
    submitted_at: string;
  }>;
  public_links: {
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
  };
  last_updated_at: string | null;
}

interface UpdateShareScoreInput {
  enabled: boolean;
  regenerate?: boolean;
}

type ShareUserRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  score_share_enabled: boolean;
  score_share_token: string | null;
  score_share_updated_at: Date | string | null;
  updated_at: Date | string | null;
  trust_updated_at?: Date | string | null;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export class ShareScoreService {
  private readonly dashboardService: DashboardService;

  constructor(dashboardService: DashboardService = new DashboardService()) {
    this.dashboardService = dashboardService;
  }

  private buildPublicUrl(token: string | null, enabled: boolean): string | null {
    if (!enabled || !token) return null;
    return `${trimTrailingSlash(config.FRONTEND_URL)}/share/${token}`;
  }

  private toIsoTimestamp(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private mapSettings(row: ShareUserRow): ShareScoreSettings {
    return {
      enabled: Boolean(row.score_share_enabled),
      token_present: Boolean(row.score_share_token),
      public_url: this.buildPublicUrl(row.score_share_token, Boolean(row.score_share_enabled)),
      updated_at: this.toIsoTimestamp(row.score_share_updated_at ?? row.updated_at),
    };
  }

  private async getShareRowByUserId(userId: string): Promise<ShareUserRow> {
    const result = await query(
      `SELECT id, name, avatar_url, headline, location,
              github_url, linkedin_url, portfolio_url,
              score_share_enabled, score_share_token, score_share_updated_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0] as ShareUserRow;
  }

  async getShareSettings(userId: string): Promise<ShareScoreSettings> {
    const row = await this.getShareRowByUserId(userId);
    return this.mapSettings(row);
  }

  async updateShareSettings(
    userId: string,
    input: UpdateShareScoreInput,
  ): Promise<ShareScoreSettings> {
    const current = await this.getShareRowByUserId(userId);
    const nextEnabled = Boolean(input.enabled);
    const nextToken = nextEnabled
      ? input.regenerate || !current.score_share_token
        ? randomUUID()
        : current.score_share_token
      : current.score_share_token;

    const result = await query(
      `UPDATE users
       SET score_share_enabled = $2,
           score_share_token = $3,
           score_share_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, avatar_url, headline, location,
                 github_url, linkedin_url, portfolio_url,
                 score_share_enabled, score_share_token, score_share_updated_at, updated_at`,
      [userId, nextEnabled, nextToken],
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapSettings(result.rows[0] as ShareUserRow);
  }

  async getPublicSharedScore(token: string): Promise<PublicShareScoreData> {
    const userResult = await query(
      `SELECT u.id, u.name, u.avatar_url, u.headline, u.location,
              u.github_url, u.linkedin_url, u.portfolio_url,
              u.score_share_enabled, u.score_share_token, u.score_share_updated_at, u.updated_at,
              ts.updated_at AS trust_updated_at
       FROM users u
       LEFT JOIN trust_scores ts ON ts.user_id = u.id
       WHERE u.score_share_enabled = true
         AND u.score_share_token = $1`,
      [token],
    );

    if (userResult.rows.length === 0) {
      throw new Error('Shared score not found');
    }

    const user = userResult.rows[0] as ShareUserRow;
    const dashboard = await this.dashboardService.getUserDashboard(user.id);

    const recentResult = await query(
      `SELECT c.title AS challenge_title,
              c.category,
              s.language,
              s.score,
              s.submitted_at
       FROM submissions s
       JOIN challenges c ON c.id = s.challenge_id
       WHERE s.user_id = $1
         AND s.status = 'graded'
         AND s.score IS NOT NULL
       ORDER BY s.submitted_at DESC
       LIMIT 3`,
      [user.id],
    );

    const publicLinks: PublicShareScoreData['public_links'] = {};
    if (user.github_url) publicLinks.github_url = user.github_url;
    if (user.linkedin_url) publicLinks.linkedin_url = user.linkedin_url;
    if (user.portfolio_url) publicLinks.portfolio_url = user.portfolio_url;

    const timestamps = [
      this.toIsoTimestamp(user.score_share_updated_at),
      this.toIsoTimestamp(user.updated_at),
      this.toIsoTimestamp(user.trust_updated_at),
      ...recentResult.rows.map((row) => this.toIsoTimestamp(row.submitted_at)),
    ].filter((value): value is string => Boolean(value));

    const lastUpdatedAt =
      timestamps.length > 0
        ? new Date(
            Math.max(
              ...timestamps.map((value) => new Date(value).getTime()),
            ),
          ).toISOString()
        : null;

    return {
      name: user.name,
      avatar_url: user.avatar_url ?? null,
      headline: user.headline ?? null,
      location: user.location ?? null,
      total_score: dashboard.total_score,
      trust_level: dashboard.trust_level,
      seniority_band: dashboard.seniority_band,
      monthly_progress: dashboard.monthly_progress,
      category_scores: dashboard.category_scores,
      top_recent_results: recentResult.rows.map((row) => ({
        challenge_title: row.challenge_title,
        category: row.category,
        language: row.language,
        score: Number(row.score ?? 0),
        submitted_at: new Date(row.submitted_at).toISOString(),
      })),
      public_links: publicLinks,
      last_updated_at: lastUpdatedAt,
    };
  }
}
