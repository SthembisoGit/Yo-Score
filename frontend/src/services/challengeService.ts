import apiClient from './apiClient';

export interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
  updated_at: string;
  estimated_time?: number; // in minutes
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
    const response = await apiClient.get<Challenge[]>('/challenges');
    return response.data;
  }

  async getChallengeById(challengeId: string): Promise<Challenge> {
    const response = await apiClient.get<Challenge>(`/challenges/${challengeId}`);
    return response.data;
  }

  async getChallengeWithStats(challengeId: string): Promise<ChallengeWithStats> {
    const response = await apiClient.get<ChallengeWithStats>(`/challenges/${challengeId}/stats`);
    return response.data;
  }

  async getChallengeDocs(challengeId: string): Promise<ChallengeDocs[]> {
    const response = await apiClient.get<ChallengeDocs[]>(`/challenges/${challengeId}/docs`);
    return response.data;
  }

  async submitChallenge(
    challengeId: string, 
    code: string, 
    sessionId?: string
  ): Promise<ChallengeSubmission> {
    const payload: any = {
      challenge_id: challengeId,
      code
    };
    
    // Include session ID if provided (for proctoring)
    if (sessionId) {
      payload.session_id = sessionId;
    }
    
    const response = await apiClient.post<ChallengeSubmission>('/submissions', payload);
    return response.data;
  }

  async getAssignedChallenge(): Promise<Challenge> {
    const response = await apiClient.get<Challenge>('/challenges/assigned');
    return response.data;
  }

  async getChallengesByCategory(category: string): Promise<Challenge[]> {
    const response = await apiClient.get<Challenge[]>(`/challenges/category/${category}`);
    return response.data;
  }

  async getChallengesByDifficulty(difficulty: string): Promise<Challenge[]> {
    const response = await apiClient.get<Challenge[]>(`/challenges/difficulty/${difficulty}`);
    return  response.data;
  }

  async searchChallenges(query: string): Promise<Challenge[]> {
    const response = await apiClient.get<Challenge[]>(`/challenges/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  async getRecommendedChallenges(): Promise<Challenge[]> {
    const response = await apiClient.get<Challenge[]>('/challenges/recommended');
    return  response.data;
  }

  async getNextChallenge(): Promise<Challenge> {
    const response = await apiClient.get<Challenge>('/challenges/next');
    return response.data;
  }

  async markChallengeAsCompleted(challengeId: string): Promise<void> {
    await apiClient.post(`/challenges/${challengeId}/complete`);
  }

  async getChallengeLeaderboard(challengeId: string, limit: number = 10): Promise<Array<{
    user_id: string;
    user_name: string;
    score: number;
    submitted_at: string;
    trust_level: string;
  }>> {
    const response = await apiClient.get(`/challenges/${challengeId}/leaderboard?limit=${limit}`);
    return response.data.data || response.data;
  }

  async getChallengeProgress(challengeId: string): Promise<{
    user_attempts: number;
    user_best_score: number | null;
    user_last_submission: string | null;
    average_score: number;
    completion_rate: number;
  }> {
    const response = await apiClient.get(`/challenges/${challengeId}/progress`);
    return response.data.data || response.data;
  }

  async validateChallengeCode(challengeId: string, code: string): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    const response = await apiClient.post(`/challenges/${challengeId}/validate`, { code });
    return response.data.data || response.data;
  }

  async getChallengeTestCases(challengeId: string): Promise<Array<{
    input: string;
    expected_output: string;
    is_hidden: boolean;
  }>> {
    const response = await apiClient.get(`/challenges/${challengeId}/testcases`);
    return response.data.data || response.data;
  }

  async runTestCode(challengeId: string, code: string): Promise<{
    passed: number;
    failed: number;
    total: number;
    results: Array<{
      test_case_id: string;
      passed: boolean;
      output?: string;
      error?: string;
      execution_time: number;
    }>;
  }> {
    const response = await apiClient.post(`/challenges/${challengeId}/run`, { code });
    return response.data.data || response.data;
  }
}

export const challengeService = new ChallengeService();