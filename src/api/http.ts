import axios from 'axios';

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');

  const stripInvalidHttpsPort = (url: string): string => {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' && u.port === '80') {
        u.port = '';
        return u.toString().replace(/\/+$/, '');
      }
    } catch {
      // ignore
    }
    return url;
  };

  // Avoid Mixed Content when the frontend is served over HTTPS.
  // Keep localhost/http for local dev.
  if (typeof window !== 'undefined') {
    const isHttpsPage = window.location?.protocol === 'https:';
    const isHttpApi = trimmed.startsWith('http://');
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed);
    if (isHttpsPage && isHttpApi && !isLocalhost) {
      return stripInvalidHttpsPort(`https://${trimmed.substring('http://'.length)}`);
    }

    // Even if the API is already https, make sure it isn't mis-specified as :80.
    if (isHttpsPage && trimmed.startsWith('https://')) {
      return stripInvalidHttpsPort(trimmed);
    }
  }

  return trimmed;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080'
);

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
