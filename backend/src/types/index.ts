export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  created_at: Date;
  updated_at: Date;
}

export interface Submission {
  id: string;
  user_id: string;
  challenge_id: string;
  code: string;
  score: number | null;
  status: string;
  submitted_at: Date;
}

export interface TrustScore {
  id: string;
  user_id: string;
  total_score: number;
  trust_level: string;
  updated_at: Date;
}

export interface ProctoringLog {
  id: string;
  submission_id: string;
  violation_type: string;
  timestamp: Date;
  penalty: number;
}

export interface WorkExperience {
  id: string;
  user_id: string;
  company_name: string;
  role: string;
  duration_months: number;
  verified: boolean;
  added_at: Date;
}

export interface ReferenceDoc {
  id: string;
  challenge_id: string;
  title: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: Date;
}