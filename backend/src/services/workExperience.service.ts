import { query } from '../db';

export interface WorkExperienceInput {
  company_name: string;
  role: string;
  duration_months: number;
  verified?: boolean;
}

export class WorkExperienceService {
  async addWorkExperience(userId: string, data: WorkExperienceInput) {
    const result = await query(
      `INSERT INTO work_experience (user_id, company_name, role, duration_months, verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, company_name, role, duration_months, verified, added_at`,
      [userId, data.company_name, data.role, data.duration_months, data.verified || false]
    );

    const experience = result.rows[0];

    return {
      experience_id: experience.id,
      company_name: experience.company_name,
      role: experience.role,
      duration_months: experience.duration_months,
      verified: experience.verified
    };
  }

  async getUserWorkExperiences(userId: string) {
    const result = await query(
      `SELECT id, company_name, role, duration_months, verified, added_at
       FROM work_experience
       WHERE user_id = $1
       ORDER BY added_at DESC`,
      [userId]
    );

    return result.rows.map(exp => ({
      experience_id: exp.id,
      company_name: exp.company_name,
      role: exp.role,
      duration_months: exp.duration_months,
      verified: exp.verified,
      added_at: exp.added_at
    }));
  }
}