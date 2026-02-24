import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

type ChallengeProgressStatus = 'completed' | 'pending' | 'in_progress' | 'graded' | 'not_started';

export interface DashboardData {
  total_score: number;
  trust_level: 'Low' | 'Medium' | 'High';
  seniority_band?: 'graduate' | 'junior' | 'mid' | 'senior';
  work_experience_score?: number;
  work_experience_summary?: {
    trusted_months: number;
    total_entries: number;
    flagged_entries: number;
  };
  category_scores: {
    [category: string]: number;
  };
  monthly_progress?: number;
  challenge_progress: Array<{
    challenge_id: string;
    status: ChallengeProgressStatus;
    score: number | null;
  }>;
}

export interface WorkExperience {
  experience_id: string;
  company_name: string;
  role: string;
  duration_months: number;
  verified: boolean;
  evidence_links?: string[] | unknown;
  verification_status?: 'pending' | 'verified' | 'flagged' | 'rejected';
  risk_score?: number;
  added_at: string | null;
}

export interface AddWorkExperienceInput {
  company_name: string;
  role: string;
  duration_months: number;
  evidence_links?: string[];
}

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  created_at: string;
}

export interface Submission {
  submission_id: string;
  challenge_id: string;
  challenge_title?: string;
  language?: 'javascript' | 'python' | 'java' | 'cpp' | 'go' | 'csharp';
  score: number | null;
  status: 'pending' | 'graded' | 'failed';
  judge_status?: 'queued' | 'running' | 'completed' | 'failed';
  submitted_at: string;
}

class DashboardService {
  async getDashboardData(): Promise<DashboardData> {
    const response = await apiClient.get('/dashboard/me');
    return unwrapData<DashboardData>(response);
  }

  async getUserProfile(): Promise<UserProfile> {
    const response = await apiClient.get('/users/me');
    return unwrapData<UserProfile>(response);
  }

  async getWorkExperience(): Promise<WorkExperience[]> {
    const response = await apiClient.get('/users/me/work-experience');
    const rows = unwrapData<WorkExperience[]>(response);
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const record = row as WorkExperience & { id?: unknown; experience_id?: unknown };
      let evidenceLinks: string[] = [];
      const raw = row.evidence_links;
      if (Array.isArray(raw)) {
        evidenceLinks = raw.map((link) => String(link ?? '').trim()).filter((link) => link.length > 0);
      } else if (typeof raw === 'string' && raw.trim().length > 0) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            evidenceLinks = parsed.map((link) => String(link ?? '').trim()).filter((link) => link.length > 0);
          }
        } catch {
          evidenceLinks = raw
            .split(/\r?\n|,/g)
            .map((link) => link.trim())
            .filter((link) => link.length > 0);
        }
      }
      const dedupedEvidence = [...new Set(evidenceLinks)].slice(0, 5);
      const rawAddedAt =
        typeof row.added_at === 'string' && row.added_at.trim().length > 0
          ? row.added_at
          : typeof (row as WorkExperience & { created_at?: unknown }).created_at === 'string' &&
              String((row as WorkExperience & { created_at?: unknown }).created_at).trim().length > 0
            ? String((row as WorkExperience & { created_at?: unknown }).created_at)
            : null;
      const parsedAddedAt =
        rawAddedAt && !Number.isNaN(new Date(rawAddedAt).getTime()) ? rawAddedAt : null;

      return {
        ...row,
        experience_id: String(record.experience_id ?? record.id ?? ''),
        duration_months: Number(row.duration_months ?? 0),
        risk_score: Number(row.risk_score ?? 0),
        verification_status: row.verification_status ?? 'pending',
        added_at: parsedAddedAt,
        evidence_links: dedupedEvidence,
      };
    });
  }

  async addWorkExperience(input: AddWorkExperienceInput): Promise<WorkExperience> {
    const response = await apiClient.post('/users/me/work-experience', input);
    return unwrapData<WorkExperience>(response);
  }

  async getUserSubmissions(): Promise<Submission[]> {
    const response = await apiClient.get('/submissions');
    return unwrapData<Submission[]>(response);
  }

  async updateProfile(
    profileData: Partial<{
      name: string;
      email: string;
      avatar_url: string | null;
      headline: string | null;
      bio: string | null;
      location: string | null;
      github_url: string | null;
      linkedin_url: string | null;
      portfolio_url: string | null;
    }>,
  ): Promise<UserProfile> {
    const response = await apiClient.put('/users/me', profileData);
    return unwrapData<UserProfile>(response);
  }
}

export const dashboardService = new DashboardService();
