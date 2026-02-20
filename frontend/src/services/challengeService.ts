import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';
import {
  isTerminalSubmissionState,
  trackPendingSubmission,
  untrackPendingSubmission,
} from './pendingSubmissionStore';

export interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  target_seniority?: 'graduate' | 'junior' | 'mid' | 'senior';
  duration_minutes?: number;
  publish_status?: 'draft' | 'published' | 'archived';
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
  judge_status: 'queued' | 'running' | 'completed' | 'failed';
  message: string;
  session_id?: string;
}

export interface CoachHintResponse {
  hint_index: number;
  remaining_hints: number;
  hint: string;
  snippet: string | null;
  policy: {
    max_hints: number;
    full_solution_blocked: boolean;
    snippet_limited: boolean;
    mode: 'concept_with_snippets';
  };
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
    language: 'javascript' | 'python',
    sessionId?: string
  ): Promise<ChallengeSubmission> {
    const payload: Record<string, unknown> = { challenge_id: challengeId, code, language };
    if (sessionId) payload.session_id = sessionId;
    const response = await apiClient.post('/submissions', payload);
    const submission = unwrapData<ChallengeSubmission>(response);

    if (isTerminalSubmissionState(submission.status, submission.judge_status)) {
      untrackPendingSubmission(submission.submission_id);
    } else {
      trackPendingSubmission(submission.submission_id);
    }

    return submission;
  }

  async getNextChallenge(category?: string): Promise<Challenge> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await apiClient.get(`/challenges/next${query}`);
    return unwrapData<Challenge>(response);
  }

  async getCoachHint(input: {
    challengeId: string;
    sessionId?: string;
    language: 'javascript' | 'python';
    code: string;
    hintIndex?: number;
  }): Promise<CoachHintResponse> {
    const response = await apiClient.post(`/challenges/${input.challengeId}/coach-hint`, {
      session_id: input.sessionId,
      language: input.language,
      code: input.code,
      hint_index: input.hintIndex,
    });
    return unwrapData<CoachHintResponse>(response);
  }
}

export const challengeService = new ChallengeService();
