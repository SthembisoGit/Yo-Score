// frontend/src/services/authService.ts
import apiClient, { setAuthToken } from './apiClient';

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

interface AuthResponse {
  token: string;
  user: {
    user_id: string;
    name: string;
    role: string;
  };
}

export const authService = {
  async signup(userData: SignupData): Promise<{ message: string; user_id: string }> {
    try {
      const response = await apiClient.post<{ message: string; user_id: string }>('/auth/signup', userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async login(credentials: LoginData): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      const { token, user } = response.data;
      
      if (token) {
        setAuthToken(token);
      }
      
      return { token, user };
    } catch (error) {
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAuthToken(null);
    }
  },

  validateToken(): boolean {
    const token = localStorage.getItem(import.meta.env.VITE_JWT_STORAGE_KEY || 'yoScore_auth_token');
    return !!token;
  }
};