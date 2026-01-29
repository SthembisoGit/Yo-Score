import apiClient from './apiClient';

export interface SubmissionResult {
  submission_id: string;
  score: number;
  trust_level: 'Low' | 'Medium' | 'High';
  violations: Array<{
    type: string;
    penalty: number;
    timestamp: string;
  }>;
  status: 'pending' | 'graded' | 'failed';
  submitted_at: string;
  challenge_title?: string;
}

export interface UserSubmission {
  submission_id: string;
  challenge_id: string;
  challenge_title: string;
  score: number | null;
  status: 'pending' | 'graded' | 'failed';
  submitted_at: string;
}

export interface SubmissionWithProctoring {
  submission_id: string;
  session_id?: string;
  score: number;
  trust_level: 'Low' | 'Medium' | 'High';
  proctoring_score: number;
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    penalty: number;
    timestamp: string;
  }>;
  code_preview: string;
  submitted_at: string;
  evaluated_at: string | null;
  feedback?: string;
}

class SubmissionService {
  /**
   * Submit a challenge with optional proctoring session
   */
  async submitChallenge(
    challengeId: string, 
    code: string, 
    sessionId?: string
  ): Promise<{ submission_id: string; status: string; message: string }> {
    try {
      const response = await apiClient.post('/submissions', {
        challenge_id: challengeId,
        code,
        session_id: sessionId // Include session ID if available
      });
      
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Submission error:', error);
      
      // Provide helpful error messages
      if (error.response?.status === 404) {
        throw new Error('Submission endpoint not found. Please check if backend is running.');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw new Error('Failed to submit challenge. Please try again.');
    }
  }

  /**
   * Get submission results
   */
  async getSubmissionResult(submissionId: string): Promise<SubmissionResult> {
    try {
      const response = await apiClient.get(`/submissions/${submissionId}`);
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Failed to get submission result:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Submission not found');
      }
      
      throw new Error('Failed to load submission results');
    }
  }

  /**
   * Get all submissions for the current user
   */
  async getUserSubmissions(limit: number = 20): Promise<UserSubmission[]> {
    try {
      const response = await apiClient.get(`/submissions?limit=${limit}`);
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Failed to get user submissions:', error);
      return [];
    }
  }

  /**
   * Get submission with detailed proctoring info
   */
  async getSubmissionWithProctoring(submissionId: string): Promise<SubmissionWithProctoring> {
    try {
      const response = await apiClient.get(`/submissions/${submissionId}/detailed`);
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Failed to get detailed submission:', error);
      
      // Return mock data if endpoint doesn't exist yet
      return {
        submission_id: submissionId,
        score: 0,
        trust_level: 'Medium',
        proctoring_score: 100,
        violations: [],
        code_preview: '// Code preview not available',
        submitted_at: new Date().toISOString(),
        evaluated_at: null
      };
    }
  }

  /**
   * Poll for submission status (for real-time updates)
   */
  async pollSubmissionStatus(
    submissionId: string, 
    interval: number = 2000, 
    maxAttempts: number = 30
  ): Promise<SubmissionResult> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const poll = async () => {
        attempts++;
        
        try {
          const result = await this.getSubmissionResult(submissionId);
          
          if (result.status !== 'pending') {
            resolve(result);
            return;
          }
          
          if (attempts >= maxAttempts) {
            reject(new Error('Submission evaluation timeout'));
            return;
          }
          
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }

  /**
   * Get submission statistics for dashboard
   */
  async getSubmissionStats(): Promise<{
    total_submissions: number;
    average_score: number;
    best_score: number;
    completed_challenges: number;
    by_category: Record<string, number>;
  }> {
    try {
      const response = await apiClient.get('/submissions/stats');
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Failed to get submission stats:', error);
      return {
        total_submissions: 0,
        average_score: 0,
        best_score: 0,
        completed_challenges: 0,
        by_category: {}
      };
    }
  }

  /**
   * Resubmit a previous submission
   */
  async resubmitChallenge(
    originalSubmissionId: string, 
    updatedCode: string
  ): Promise<{ submission_id: string; status: string }> {
    try {
      const response = await apiClient.post('/submissions/resubmit', {
        original_submission_id: originalSubmissionId,
        code: updatedCode
      });
      
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Failed to resubmit:', error);
      throw new Error('Failed to resubmit challenge');
    }
  }

  /**
   * Get code from a submission
   */
  async getSubmissionCode(submissionId: string): Promise<string> {
    try {
      const response = await apiClient.get(`/submissions/${submissionId}/code`);
      return response.data.data?.code || response.data.code || '';
    } catch (error: any) {
      console.error('Failed to get submission code:', error);
      return '// Code not available';
    }
  }

  /**
   * Compare two submissions
   */
  async compareSubmissions(
    submissionId1: string, 
    submissionId2: string
  ): Promise<{
    similarities: number;
    differences: string[];
    score_comparison: {
      submission1: number;
      submission2: number;
      difference: number;
    };
  }> {
    try {
      const response = await apiClient.post('/submissions/compare', {
        submission_id_1: submissionId1,
        submission_id_2: submissionId2
      });
      
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Failed to compare submissions:', error);
      return {
        similarities: 0,
        differences: [],
        score_comparison: {
          submission1: 0,
          submission2: 0,
          difference: 0
        }
      };
    }
  }
}

export const submissionService = new SubmissionService();