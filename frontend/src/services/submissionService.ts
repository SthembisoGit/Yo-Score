import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

export interface SubmissionViolation {
  type: string;
  penalty: number;
  timestamp: string;
}

export interface SubmissionResult {
  submission_id: string;
  challenge_id: string;
  challenge_title: string;
  status: 'pending' | 'graded' | 'failed';
  submitted_at: string;
  score: number;
  trust_level: 'Low' | 'Medium' | 'High';
  violations: SubmissionViolation[];
}

export interface UserSubmission {
  submission_id: string;
  challenge_id: string;
  challenge_title: string;
  score: number | null;
  status: 'pending' | 'graded' | 'failed';
  submitted_at: string;
}

class SubmissionService {
  async submitChallenge(
    challengeId: string,
    code: string,
    sessionId?: string
  ): Promise<{ submission_id: string; status: string; message: string }> {
    const payload: Record<string, string> = {
      challenge_id: challengeId,
      code
    };

    if (sessionId) {
      payload.session_id = sessionId;
    }

    const response = await apiClient.post('/submissions', payload);
    return unwrapData<{ submission_id: string; status: string; message: string }>(response);
  }

  async getSubmissionResult(submissionId: string): Promise<SubmissionResult> {
    const response = await apiClient.get(`/submissions/${submissionId}`);
    return unwrapData<SubmissionResult>(response);
  }

  async getUserSubmissions(): Promise<UserSubmission[]> {
    const response = await apiClient.get('/submissions');
    return unwrapData<UserSubmission[]>(response);
  }

  async pollSubmissionStatus(
    submissionId: string,
    interval = 2000,
    maxAttempts = 30
  ): Promise<SubmissionResult> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.getSubmissionResult(submissionId);
      if (result.status !== 'pending') {
        return result;
      }
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error('Submission evaluation timeout');
  }
}

export const submissionService = new SubmissionService();
