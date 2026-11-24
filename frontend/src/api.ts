import axios from 'axios';

// When running through Nginx reverse proxy or same domain, baseURL is '/api'
// Fallback to 'http://localhost:5000/api' if developing frontend standalone
const API_URL = process.env.REACT_APP_API_URL || (window.location.port === '3000' && window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api');

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lendguard_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('lendguard_token');
        localStorage.removeItem('lendguard_user');
      }
    }
    return Promise.reject(error);
  }
);
