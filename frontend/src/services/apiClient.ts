import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000/api';

const JWT_STORAGE_KEY =
  import.meta.env.VITE_JWT_STORAGE_KEY || 'yoScore_auth_token';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem(JWT_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response.data,
  async error => {
    const apiMessage: string | undefined = error?.response?.data?.message;
    if (apiMessage && typeof apiMessage === 'string') {
      error.message = apiMessage;
    }

    if (error.response?.status === 401) {
      try {
        const token = localStorage.getItem(JWT_STORAGE_KEY);
        if (!token) throw error;

        const rotateResponse = await axios.post(
          `${API_BASE_URL}/auth/rotate`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const rotatedToken = rotateResponse.data?.data?.token;
        if (!rotatedToken) {
          throw error;
        }

        localStorage.setItem(JWT_STORAGE_KEY, rotatedToken);

        error.config.headers.Authorization =
          `Bearer ${rotatedToken}`;

        return apiClient(error.config);
      } catch {
        localStorage.removeItem(JWT_STORAGE_KEY);
        window.dispatchEvent(new Event('unauthorized'));
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
