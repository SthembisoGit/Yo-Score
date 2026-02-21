import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';
import {
  cacheSubmissionSnapshot,
  isTerminalSubmissionState,
  trackPendingSubmission,
  untrackPendingSubmission,
} from './pendingSubmissionStore';
import type { SupportedLanguageCode } from '@/constants/languages';

export interface SubmissionViolation {
  type: string;
  penalty: number;
  timestamp: string;
}

export interface SubmissionScoreBreakdown {
  components: {
    correctness?: number;
    efficiency?: number;
    style?: number;
    skill: number;
    behavior: number;
    work_experience: number;
  };
  penalty: number;
  scoring_version: string;
}

export interface SubmissionPenaltySummary {
  total: number;
  violation_count: number;
}

export interface SubmissionResult {
  submission_id: string;
  challenge_id: string;
  challenge_title: string;
  language: SupportedLanguageCode;
  status: 'pending' | 'graded' | 'failed';
  judge_status: 'queued' | 'running' | 'completed' | 'failed';
  judge_error?: string | null;
  judge_run_id?: string | null;
  submitted_at: string;
  score: number | null;
  total_score?: number | null;
  trust_level?: 'Low' | 'Medium' | 'High';
  score_breakdown?: SubmissionScoreBreakdown;
  penalties?: SubmissionPenaltySummary;
  run_summary?: {
    run_id: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
    error_message?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  } | null;
  tests_summary?: {
    passed: number;
    total: number;
    runtime_ms: number;
    memory_mb: number;
  } | null;
  violations: SubmissionViolation[];
  practice_feedback?: string[];
}

export interface UserSubmission {
  submission_id: string;
  challenge_id: string;
  challenge_title: string;
  language: SupportedLanguageCode;
  score: number | null;
  status: 'pending' | 'graded' | 'failed';
  judge_status: 'queued' | 'running' | 'completed' | 'failed';
  submitted_at: string;
}

export interface SubmissionRunSummary {
  run_id: string;
  submission_id: string;
  language: SupportedLanguageCode;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  score_correctness: number;
  score_efficiency: number;
  score_style: number;
  test_passed: number;
  test_total: number;
  runtime_ms: number;
  memory_mb: number;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
}

export interface SubmissionRunDetails extends SubmissionRunSummary {
  tests: Array<{
    run_test_id: string;
    test_case_id: string;
    status: 'passed' | 'failed' | 'error';
    runtime_ms: number;
    output: string;
    error?: string | null;
    points_awarded: number;
  }>;
}

class SubmissionService {
  async submitChallenge(
    challengeId: string,
    code: string,
    language: SupportedLanguageCode,
    sessionId?: string
  ): Promise<{
    submission_id: string;
    status: 'pending' | 'graded' | 'failed';
    judge_status: 'queued' | 'running' | 'completed' | 'failed';
    message: string;
  }> {
    const payload: Record<string, string> = {
      challenge_id: challengeId,
      code,
      language,
    };

    if (sessionId) {
      payload.session_id = sessionId;
    }

    const response = await apiClient.post('/submissions', payload);
    const result = unwrapData<{
      submission_id: string;
      status: 'pending' | 'graded' | 'failed';
      judge_status: 'queued' | 'running' | 'completed' | 'failed';
      message: string;
    }>(response);

    if (isTerminalSubmissionState(result.status, result.judge_status)) {
      untrackPendingSubmission(result.submission_id);
    } else {
      trackPendingSubmission(result.submission_id);
    }

    return result;
  }

  async getSubmissionResult(submissionId: string): Promise<SubmissionResult> {
    const response = await apiClient.get(`/submissions/${submissionId}`);
    const result = unwrapData<SubmissionResult>(response);

    cacheSubmissionSnapshot(submissionId, {
      ...result,
      cached_at: new Date().toISOString(),
    });

    if (isTerminalSubmissionState(result.status, result.judge_status)) {
      untrackPendingSubmission(submissionId);
    } else {
      trackPendingSubmission(submissionId);
    }

    return result;
  }

  async getUserSubmissions(): Promise<UserSubmission[]> {
    const response = await apiClient.get('/submissions');
    return unwrapData<UserSubmission[]>(response);
  }

  async getSubmissionRuns(submissionId: string): Promise<SubmissionRunSummary[]> {
    const response = await apiClient.get(`/submissions/${submissionId}/runs`);
    return unwrapData<SubmissionRunSummary[]>(response);
  }

  async getSubmissionRunDetails(
    submissionId: string,
    runId: string,
  ): Promise<SubmissionRunDetails> {
    const response = await apiClient.get(`/submissions/${submissionId}/runs/${runId}`);
    return unwrapData<SubmissionRunDetails>(response);
  }

  async pollSubmissionStatus(
    submissionId: string,
    interval = 2000,
    maxAttempts = 30
  ): Promise<SubmissionResult> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.getSubmissionResult(submissionId);
      if (
        result.status !== 'pending' &&
        result.judge_status !== 'queued' &&
        result.judge_status !== 'running'
      ) {
        return result;
      }
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error('Submission evaluation timeout');
  }
}

export const submissionService = new SubmissionService();
