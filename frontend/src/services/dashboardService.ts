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
  evidence_links?: string[];
  verification_status?: 'pending' | 'verified' | 'flagged' | 'rejected';
  risk_score?: number;
  added_at: string;
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
  created_at: string;
}

export interface Submission {
  submission_id: string;
  challenge_id: string;
  score: number | null;
  status: 'pending' | 'graded' | 'failed';
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
    return unwrapData<WorkExperience[]>(response);
  }

  async addWorkExperience(input: AddWorkExperienceInput): Promise<WorkExperience> {
    const response = await apiClient.post('/users/me/work-experience', input);
    return unwrapData<WorkExperience>(response);
  }

  async getUserSubmissions(): Promise<Submission[]> {
    const response = await apiClient.get('/submissions');
    return unwrapData<Submission[]>(response);
  }

  async updateProfile(profileData: Partial<{ name: string; email: string }>): Promise<UserProfile> {
    const response = await apiClient.put('/users/me', profileData);
    return unwrapData<UserProfile>(response);
  }
}

export const dashboardService = new DashboardService();
