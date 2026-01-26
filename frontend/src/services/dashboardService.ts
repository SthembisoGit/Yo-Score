import apiClient from './apiClient';

export interface DashboardData {
  total_score: number;
  trust_level: 'Low' | 'Medium' | 'High';
  category_scores: {
    [category: string]: number;
  };
  challenge_progress: Array<{
    challenge_id: string;
    status: 'completed' | 'in_progress' | 'pending';
    score: number;
  }>;
}

export interface WorkExperience {
  experience_id: string;
  company_name: string;
  role: string;
  duration_months: number;
  verified: boolean;
  added_at: string;
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
  score: number;
  status: 'pending' | 'graded' | 'failed';
  submitted_at: string;
}

class DashboardService {
  async getDashboardData(): Promise<DashboardData> {
    const response = await apiClient.get<DashboardData>('/dashboard/me');
    return response.data;
  }

  async getUserProfile(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/users/me');
    return response.data;
  }

  async getWorkExperience(): Promise<WorkExperience[]> {
    const response = await apiClient.get<WorkExperience[]>('/users/me/work-experience');
    return response.data;
  }

  async getUserSubmissions(): Promise<Submission[]> {
    const response = await apiClient.get<Submission[]>('/submissions/user/me');
    return response.data;
  }

  async updateProfile(profileData: Partial<{ name: string; email: string }>): Promise<UserProfile> {
    const response = await apiClient.put<UserProfile>('/users/me', profileData);
    return response.data;
  }
}

export const dashboardService = new DashboardService();