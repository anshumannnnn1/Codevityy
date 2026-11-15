import axios from 'axios';
import { auth } from './firebase';

export const api = axios.create({
  baseURL: '/api',
  timeout: 45000,
});

api.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function extractApiErrorMessage(err: unknown, fallback = 'Request failed.'): string {
  if (axios.isAxiosError(err)) {
    const serverMsg = (err.response?.data as { error?: string } | undefined)?.error;
    if (serverMsg) return serverMsg;
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
