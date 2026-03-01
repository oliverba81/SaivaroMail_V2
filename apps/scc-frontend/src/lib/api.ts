import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Axios-Instance mit Token
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request-Interceptor: Token hinzufügen
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('scc_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response-Interceptor: Bei 401 → Logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('scc_token');
      localStorage.removeItem('scc_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;






