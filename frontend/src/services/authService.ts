import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: string;
}

interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    user_id: string;
    name: string;
    email?: string;
    role: string;
  };
}

const JWT_STORAGE_KEY =
  import.meta.env.VITE_JWT_STORAGE_KEY || 'yoScore_auth_token';

export const authService = {
  async signup(userData: SignupData): Promise<{ message: string; user_id: string }> {
    const response = await apiClient.post('/auth/signup', userData);
    return unwrapData<{ message: string; user_id: string }>(response);
  },

  async login(credentials: LoginData): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', credentials);
    const result = unwrapData<AuthResponse>(response);
    if (result.token) {
      localStorage.setItem(JWT_STORAGE_KEY, result.token);
    }
    return result;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem(JWT_STORAGE_KEY);
    }
  },

  hasToken(): boolean {
    return !!localStorage.getItem(JWT_STORAGE_KEY);
  },

  async validateToken(): Promise<{ valid: boolean; user?: { user_id: string; name: string; email: string; role: string } }> {
    const response = await apiClient.get('/auth/validate');
    const body = unwrapData<{ valid?: boolean; user?: { user_id: string; name: string; email: string; role: string } }>(response);
    return body.valid && body.user ? { valid: true, user: body.user } : { valid: false };
  }
};
