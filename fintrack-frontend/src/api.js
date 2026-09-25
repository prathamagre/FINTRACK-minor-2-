import axios from 'axios';

const baseURL = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'fintrack_access_token';
let unauthorizedHandler = () => {};

const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = window.sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.sessionStorage.getItem(TOKEN_KEY)) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export const saveAccessToken = (token) => window.sessionStorage.setItem(TOKEN_KEY, token);
export const clearAccessToken = () => window.sessionStorage.removeItem(TOKEN_KEY);
export const hasAccessToken = () => Boolean(window.sessionStorage.getItem(TOKEN_KEY));
export const setUnauthorizedHandler = (handler) => { unauthorizedHandler = handler || (() => {}); };

export default api;
