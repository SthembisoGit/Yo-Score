import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

export interface AdminDashboardSummary {
  users_total: number;
  challenges_total: number;
  submissions_total: number;
  judge_pending: number;
  judge_failed: number;
  queue: Record<string, number>;
}

export interface AdminChallenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  target_seniority: 'graduate' | 'junior' | 'mid' | 'senior';
  duration_minutes: number;
  publish_status: 'draft' | 'published' | 'archived';
  readiness: {
    has_tests: boolean;
    baseline_languages: string[];
    missing_languages: string[];
    is_ready: boolean;
  };
}

export interface AdminChallengeTestCase {
  id: string;
  name: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  timeout_ms: number;
  memory_mb: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface AdminChallengeBaseline {
  id: string;
  language: 'javascript' | 'python';
  runtime_ms: number;
  memory_mb: number;
  lint_rules: Record<string, unknown>;
  updated_at: string;
}

export interface AdminChallengeDoc {
  doc_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AdminJudgeRun {
  id: string;
  submission_id: string;
  language: 'javascript' | 'python';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  score_correctness: number;
  score_efficiency: number;
  score_style: number;
  test_passed: number;
  test_total: number;
  runtime_ms: number;
  memory_mb: number;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  user_email: string;
  challenge_title: string;
}

export interface AdminUser {
  user_id: string;
  name: string;
  email: string;
  role: 'developer' | 'recruiter' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface AdminProctoringSummary {
  totalViolations: number;
  totalPenalty: number;
  byType: Record<
    string,
    {
      count: number;
      penalty: number;
      severity: 'low' | 'medium' | 'high';
    }
  >;
  bySeverity: Record<
    string,
    {
      count: number;
      penalty: number;
    }
  >;
}

export interface AdminProctoringSession {
  id: string;
  user_id: string;
  challenge_id: string;
  submission_id: string | null;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'paused' | 'completed';
  total_violations: number;
  total_penalty: number;
  pause_count: number;
  total_paused_seconds: number;
  pause_reason: string | null;
  user_name: string | null;
  user_email: string | null;
  challenge_title: string | null;
}

export interface AdminProctoringSessionDetail {
  session: AdminProctoringSession;
  violations: Array<{
    id: string;
    violation_type: string;
    severity: 'low' | 'medium' | 'high';
    description: string | null;
    penalty: number;
    confidence: number;
    timestamp: string;
    evidence_data: unknown;
  }>;
  mlAnalyses: Array<{
    id: string;
    analysis_type: string;
    timestamp: string;
    results: Record<string, unknown>;
    violations_detected: number;
    created_at: string;
  }>;
  proctoringScore: number;
  stats: {
    violations: {
      total: number;
      bySeverity: {
        high: number;
        medium: number;
        low: number;
      };
      byType: Record<string, number>;
    };
    mlAnalyses: {
      total: number;
      byType: Record<string, number>;
    };
  };
  duration: string;
}

export interface AdminProctoringSettings {
  requireCamera: boolean;
  requireMicrophone: boolean;
  requireAudio: boolean;
  strictMode: boolean;
  allowedViolationsBeforeWarning: number;
  autoPauseOnViolation: boolean;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  admin_email: string | null;
  target_email: string | null;
}

export interface AdminFlaggedWorkExperience {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  company_name: string;
  role: string;
  duration_months: number;
  evidence_links: string[];
  verification_status: 'pending' | 'verified' | 'flagged' | 'rejected';
  risk_score: number;
  added_at: string;
}

class AdminService {
  async getDashboard() {
    const response = await apiClient.get('/admin/dashboard');
    return unwrapData<AdminDashboardSummary>(response);
  }

  async createChallenge(payload: {
    title: string;
    description: string;
    category: string;
    difficulty: string;
    target_seniority?: 'graduate' | 'junior' | 'mid' | 'senior';
    duration_minutes?: number;
    publish_status?: 'draft' | 'published' | 'archived';
  }) {
    const response = await apiClient.post('/admin/challenges', payload);
    return unwrapData<AdminChallenge>(response);
  }

  async listChallenges() {
    const response = await apiClient.get('/admin/challenges');
    return unwrapData<AdminChallenge[]>(response);
  }

  async updateChallenge(
    challengeId: string,
    payload: Partial<{
      title: string;
      description: string;
      category: string;
      difficulty: string;
      target_seniority: 'graduate' | 'junior' | 'mid' | 'senior';
      duration_minutes: number;
    }>,
  ) {
    const response = await apiClient.put(`/admin/challenges/${challengeId}`, payload);
    return unwrapData(response);
  }

  async setChallengeStatus(challengeId: string, publish_status: 'draft' | 'published' | 'archived') {
    const response = await apiClient.put(`/admin/challenges/${challengeId}/publish`, {
      publish_status,
    });
    return unwrapData(response);
  }

  async getChallengeTests(challengeId: string) {
    const response = await apiClient.get(`/admin/challenges/${challengeId}/tests`);
    return unwrapData<AdminChallengeTestCase[]>(response);
  }

  async upsertChallengeTest(
    challengeId: string,
    payload: {
      test_id?: string;
      name: string;
      input: string;
      expected_output: string;
      points?: number;
      timeout_ms?: number;
      memory_mb?: number;
      is_hidden?: boolean;
      order_index?: number;
    },
  ) {
    const { test_id, ...body } = payload;
    const response = test_id
      ? await apiClient.put(`/admin/challenges/${challengeId}/tests/${test_id}`, body)
      : await apiClient.post(`/admin/challenges/${challengeId}/tests`, body);
    return unwrapData(response);
  }

  async deleteChallengeTest(challengeId: string, testId: string) {
    const response = await apiClient.delete(`/admin/challenges/${challengeId}/tests/${testId}`);
    return unwrapData(response);
  }

  async getChallengeBaseline(challengeId: string, language: 'javascript' | 'python') {
    const response = await apiClient.get(`/admin/challenges/${challengeId}/baseline?language=${language}`);
    return unwrapData<AdminChallengeBaseline | null>(response);
  }

  async upsertChallengeBaseline(
    challengeId: string,
    payload: {
      language: 'javascript' | 'python';
      runtime_ms: number;
      memory_mb: number;
      lint_rules?: Record<string, unknown>;
    },
  ) {
    const response = await apiClient.put(`/admin/challenges/${challengeId}/baseline`, payload);
    return unwrapData(response);
  }

  async listChallengeDocs(challengeId: string) {
    const response = await apiClient.get(`/admin/challenges/${challengeId}/docs`);
    return unwrapData<AdminChallengeDoc[]>(response);
  }

  async createChallengeDoc(
    challengeId: string,
    payload: {
      title: string;
      content: string;
    },
  ) {
    const response = await apiClient.post(`/admin/challenges/${challengeId}/docs`, payload);
    return unwrapData<AdminChallengeDoc>(response);
  }

  async getJudgeHealth() {
    const response = await apiClient.get('/admin/judge/health');
    return unwrapData(response);
  }

  async listJudgeRuns(limit = 50, status?: string) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (status) query.set('status', status);
    const response = await apiClient.get(`/admin/judge/runs?${query.toString()}`);
    return unwrapData<AdminJudgeRun[]>(response);
  }

  async retryJudgeRun(runId: string) {
    const response = await apiClient.post(`/admin/judge/runs/${runId}/retry`);
    return unwrapData(response);
  }

  async listProctoringSessions(limit = 50) {
    const response = await apiClient.get(`/admin/proctoring/sessions?limit=${limit}`);
    return unwrapData<AdminProctoringSession[]>(response);
  }

  async getProctoringSummary() {
    const response = await apiClient.get('/admin/proctoring/summary');
    return unwrapData<AdminProctoringSummary>(response);
  }

  async getProctoringSession(sessionId: string) {
    const response = await apiClient.get(`/admin/proctoring/sessions/${sessionId}`);
    return unwrapData<AdminProctoringSessionDetail>(response);
  }

  async getProctoringSettings() {
    const response = await apiClient.get('/admin/proctoring/settings');
    return unwrapData<AdminProctoringSettings>(response);
  }

  async updateProctoringSettings(payload: {
    requireCamera?: boolean;
    requireMicrophone?: boolean;
    requireAudio?: boolean;
    strictMode?: boolean;
    allowedViolationsBeforeWarning?: number;
    autoPauseOnViolation?: boolean;
  }) {
    const response = await apiClient.put('/admin/proctoring/settings', payload);
    return unwrapData<AdminProctoringSettings>(response);
  }

  async listUsers() {
    const response = await apiClient.get('/admin/users');
    return unwrapData<AdminUser[]>(response);
  }

  async updateUserRole(userId: string, role: 'developer' | 'recruiter' | 'admin') {
    const response = await apiClient.put(`/admin/users/${userId}/role`, { role });
    return unwrapData<AdminUser>(response);
  }

  async getAuditLogs(limit = 50) {
    const response = await apiClient.get(`/admin/audit-logs?limit=${limit}`);
    return unwrapData<AdminAuditLog[]>(response);
  }

  async getFlaggedWorkExperience(limit = 50) {
    const response = await apiClient.get(`/admin/work-experience/flagged?limit=${limit}`);
    return unwrapData<AdminFlaggedWorkExperience[]>(response);
  }
}

export const adminService = new AdminService();
