import apiClient from './apiClient';

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

const JWT_STORAGE_KEY =
  import.meta.env.VITE_JWT_STORAGE_KEY || 'yoScore_auth_token';

export const authService = {
  async signup(userData: SignupData): Promise<{ message: string; user_id: string }> {
    return await apiClient.post('/auth/signup', userData);
  },

  async login(credentials: LoginData): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>(
      '/auth/login',
      credentials
    );

    if (result.data.token) {
      localStorage.setItem(JWT_STORAGE_KEY, result.data.token);
    }

    return result.data;
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
  }
};
