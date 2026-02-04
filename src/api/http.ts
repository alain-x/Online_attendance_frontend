import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const http = axios.create({
  // Support both names to avoid misconfiguration
  baseURL: API_BASE_URL,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const companyContextId = localStorage.getItem('companyContextId');
  if (companyContextId) {
    const n = Number(companyContextId);
    if (!Number.isNaN(n) && n > 0) {
      config.headers = config.headers || {};
      config.headers['X-Company-Id'] = String(n);
    }
  }
  return config;
});

export default http;
