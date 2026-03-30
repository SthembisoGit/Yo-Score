import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

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
  trust_level: 'Low' | 'Medium' | 'High';
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

class ShareScoreService {
  async getMyShareSettings(): Promise<ShareScoreSettings> {
    const response = await apiClient.get('/users/me/share-score');
    return unwrapData<ShareScoreSettings>(response);
  }

  async updateMyShareSettings(input: {
    enabled: boolean;
    regenerate?: boolean;
  }): Promise<ShareScoreSettings> {
    const response = await apiClient.put('/users/me/share-score', input);
    return unwrapData<ShareScoreSettings>(response);
  }

  async getPublicShareScore(token: string): Promise<PublicShareScoreData> {
    const response = await apiClient.get(`/public/share-score/${token}`);
    return unwrapData<PublicShareScoreData>(response);
  }
}

export const shareScoreService = new ShareScoreService();
