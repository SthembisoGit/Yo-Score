import { query } from '../db';
import { scoringService } from './scoring.service';

export interface WorkExperienceInput {
  company_name: string;
  role: string;
  duration_months: number;
  evidence_links?: string[];
}

export class WorkExperienceService {
  private isMissingSchemaError(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    const message = (error as { message?: string })?.message ?? '';
    return code === '42703' || code === '42P01' || /does not exist/i.test(message);
  }

  private normalizeEvidenceLinks(rawLinks: unknown): string[] {
    if (Array.isArray(rawLinks)) {
      const links = rawLinks
        .map((link) => String(link ?? '').trim())
        .filter((link) => link.length > 0)
        .slice(0, 5);

      const deduped: string[] = [];
      for (const link of links) {
        if (!deduped.includes(link)) deduped.push(link);
      }
      return deduped;
    }

    if (typeof rawLinks === 'string' && rawLinks.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawLinks);
        if (Array.isArray(parsed)) {
          return this.normalizeEvidenceLinks(parsed);
        }
      } catch {
        const fallback = rawLinks
          .split(/\r?\n|,/g)
          .map((link) => link.trim())
          .filter((link) => link.length > 0)
          .slice(0, 5);
        const deduped: string[] = [];
        for (const link of fallback) {
          if (!deduped.includes(link)) deduped.push(link);
        }
        return deduped;
      }
    }

    return [];
  }

  private mapExperienceRow(
    experience: Record<string, unknown>,
  ): {
    experience_id: string;
    company_name: string;
    role: string;
    duration_months: number;
    verified: boolean;
    evidence_links: string[];
    verification_status: 'pending' | 'verified' | 'flagged' | 'rejected';
    risk_score: number;
    added_at: string | null;
  } {
    const verificationStatus = String(experience.verification_status ?? 'pending');
    const normalizedStatus: 'pending' | 'verified' | 'flagged' | 'rejected' =
      verificationStatus === 'verified' ||
      verificationStatus === 'flagged' ||
      verificationStatus === 'rejected'
        ? verificationStatus
        : 'pending';

    const addedAtRaw = experience.added_at;
    let addedAt: string | null = null;
    if (typeof addedAtRaw === 'string' && addedAtRaw.trim().length > 0) {
      addedAt = addedAtRaw;
    } else if (addedAtRaw instanceof Date && !Number.isNaN(addedAtRaw.getTime())) {
      addedAt = addedAtRaw.toISOString();
    }

    return {
      experience_id: String(experience.id ?? experience.experience_id ?? ''),
      company_name: String(experience.company_name ?? ''),
      role: String(experience.role ?? ''),
      duration_months: Number(experience.duration_months ?? 0),
      verified:
        experience.verified === true ||
        experience.verified === 'true' ||
        experience.verified === 1 ||
        experience.verified === '1',
      evidence_links: this.normalizeEvidenceLinks(experience.evidence_links),
      verification_status: normalizedStatus,
      risk_score: Number(experience.risk_score ?? 0),
      added_at: addedAt,
    };
  }

  private computeRiskScore(durationMonths: number, evidenceLinks: string[]): number {
    let risk = 0;

    if (evidenceLinks.length === 0) {
      risk += 45;
    }

    for (const link of evidenceLinks) {
      if (!/^https?:\/\//i.test(link)) {
        risk += 20;
      }
    }

    if (durationMonths > 120) {
      risk += 25;
    } else if (durationMonths > 72) {
      risk += 10;
    }

    if (evidenceLinks.length >= 3) {
      risk -= 10;
    }

    const hasLinkedIn = evidenceLinks.some((link) => /linkedin\.com/i.test(link));
    const hasGithub = evidenceLinks.some((link) => /github\.com/i.test(link));
    if (hasLinkedIn && hasGithub) {
      risk -= 10;
    }

    return Math.max(0, Math.min(100, risk));
  }

  private getVerificationStatus(riskScore: number): 'pending' | 'flagged' {
    return riskScore > 70 ? 'flagged' : 'pending';
  }

  async addWorkExperience(userId: string, data: WorkExperienceInput) {
    const evidenceLinks = this.normalizeEvidenceLinks(data.evidence_links ?? []);
    const riskScore = this.computeRiskScore(data.duration_months, evidenceLinks);
    const verificationStatus = this.getVerificationStatus(riskScore);

    let result;
    try {
      result = await query(
        `INSERT INTO work_experience
           (user_id, company_name, role, duration_months, verified, evidence_links, verification_status, risk_score)
         VALUES ($1, $2, $3, $4, false, $5::jsonb, $6, $7)
         RETURNING id, user_id, company_name, role, duration_months, verified, evidence_links, verification_status, risk_score, added_at`,
        [
          userId,
          data.company_name,
          data.role,
          data.duration_months,
          JSON.stringify(evidenceLinks),
          verificationStatus,
          riskScore,
        ],
      );
    } catch (error) {
      if (!this.isMissingSchemaError(error)) {
        throw error;
      }
      result = await query(
        `INSERT INTO work_experience
           (user_id, company_name, role, duration_months, verified)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id, user_id, company_name, role, duration_months, verified`,
        [userId, data.company_name, data.role, data.duration_months],
      );
    }

    const experience = this.mapExperienceRow(result.rows[0] as Record<string, unknown>);
    await scoringService.recomputeTrustScore(userId);

    return experience;
  }

  async getUserWorkExperiences(userId: string) {
    let result;
    try {
      result = await query(
        `SELECT id, company_name, role, duration_months, verified, evidence_links, verification_status, risk_score, added_at
         FROM work_experience
         WHERE user_id = $1
         ORDER BY added_at DESC`,
        [userId],
      );
    } catch (error) {
      if (!this.isMissingSchemaError(error)) {
        throw error;
      }
      try {
        result = await query(
          `SELECT id, company_name, role, duration_months, verified, added_at
           FROM work_experience
           WHERE user_id = $1
           ORDER BY added_at DESC`,
          [userId],
        );
      } catch (legacyError) {
        if (!this.isMissingSchemaError(legacyError)) {
          throw legacyError;
        }
        result = await query(
          `SELECT id, company_name, role, duration_months, verified
           FROM work_experience
           WHERE user_id = $1
           ORDER BY id DESC`,
          [userId],
        );
      }
    }

    return result.rows.map((exp) => this.mapExperienceRow(exp as Record<string, unknown>));
  }
}
