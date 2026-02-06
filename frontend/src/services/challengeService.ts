import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

export interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
  updated_at: string;
  estimated_time?: number;
  tags?: string[];
}

export interface ChallengeDocs {
  doc_id: string;
  title: string;
  content: string;
  language?: string;
}

export interface ChallengeSubmission {
  submission_id: string;
  status: 'pending' | 'graded' | 'failed';
  message: string;
  session_id?: string;
}

export interface ChallengeWithStats extends Challenge {
  total_submissions: number;
  average_score: number;
  user_best_score?: number;
  user_attempts: number;
}

class ChallengeService {
  async getAllChallenges(): Promise<Challenge[]> {
    const response = await apiClient.get('/challenges');
    return unwrapData<Challenge[]>(response);
  }

  async getChallengeById(challengeId: string): Promise<Challenge> {
    const response = await apiClient.get(`/challenges/${challengeId}`);
    return unwrapData<Challenge>(response);
  }

  async getChallengeDocs(challengeId: string): Promise<ChallengeDocs[]> {
    const response = await apiClient.get(`/challenges/${challengeId}/docs`);
    return unwrapData<ChallengeDocs[]>(response);
  }

  async submitChallenge(
    challengeId: string,
    code: string,
    sessionId?: string
  ): Promise<ChallengeSubmission> {
    const payload: Record<string, unknown> = { challenge_id: challengeId, code };
    if (sessionId) payload.session_id = sessionId;
    const response = await apiClient.post('/submissions', payload);
    return unwrapData<ChallengeSubmission>(response);
  }

  async getNextChallenge(): Promise<Challenge> {
    const response = await apiClient.get('/challenges/next');
    return unwrapData<Challenge>(response);
  }
}

export const challengeService = new ChallengeService();