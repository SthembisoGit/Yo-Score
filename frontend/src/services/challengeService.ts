import apiClient from './apiClient';

export interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
  updated_at: string;
}

export interface ChallengeDocs {
  doc_id: string;
  title: string;
  content: string;
}

export interface ChallengeSubmission {
  submission_id: string;
  status: 'pending' | 'graded' | 'failed';
  message: string;
}

class ChallengeService {
  async getAllChallenges(): Promise<Challenge[]> {
    const response = await apiClient.get<Challenge[]>('/challenges');
    return response.data;
  }

  async getChallengeById(challengeId: string): Promise<Challenge> {
    const response = await apiClient.get<Challenge>(`/challenges/${challengeId}`);
    return response.data;
  }

  async getChallengeDocs(challengeId: string): Promise<ChallengeDocs[]> {
    const response = await apiClient.get<ChallengeDocs[]>(`/challenges/${challengeId}/docs`);
    return response.data;
  }

  async submitChallenge(challengeId: string, code: string): Promise<ChallengeSubmission> {
    const response = await apiClient.post<ChallengeSubmission>('/submissions', {
      challenge_id: challengeId,
      code
    });
    return response.data;
  }

  async getAssignedChallenge(): Promise<Challenge> {
    const response = await apiClient.get<Challenge>('/challenges/assigned');
    return response.data;
  }
}

export const challengeService = new ChallengeService();