import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://blursocial.codiac.online';

export const SESSION_KEY = 'blur_session_token';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(api, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status === 503,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  if (token) {
    config.headers.Cookie = `blur_session=${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const sessionMatch = setCookie.toString().match(/blur_session=([^;]+)/);
      if (sessionMatch?.[1]) {
        SecureStore.setItemAsync(SESSION_KEY, sessionMatch[1]);
      }
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function loginUser(username: string, password: string) {
  const { data } = await api.post('/api/auth/login', { username, password });
  return data;
}

export async function registerUser(username: string, password: string) {
  const { data } = await api.post('/api/auth/register', { username, password });
  return data;
}

export async function googleAuth(idToken: string) {
  const { data } = await api.post('/api/auth/google', { idToken });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/api/auth/me');
  return data;
}

export async function logout() {
  const { data } = await api.post('/api/auth/logout');
  await SecureStore.deleteItemAsync(SESSION_KEY);
  return data;
}

// ── Rooms API ─────────────────────────────────────────────────────────────────

export interface RoomData {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  expiresAt?: string | null;
}

export async function fetchRooms(): Promise<RoomData[]> {
  const { data } = await api.get('/api/rooms');
  return data.rooms || [];
}

export async function createRoom(name: string, password: string, duration: number) {
  const { data } = await api.post('/api/rooms', { name, password, duration });
  return data;
}

export async function deleteRoom(slug: string) {
  const { data } = await api.delete(`/api/rooms/${slug}`);
  return data;
}

export async function verifyRoom(slug: string, password: string) {
  const { data } = await api.post(`/api/rooms/${slug}/verify`, { password });
  return data;
}

// ── Messages API ──────────────────────────────────────────────────────────────

export interface MessageData {
  id: string;
  content: string;
  timestamp: string;
  tempId?: string;
  reactions: { emoji: string; count: number; reacted?: boolean; hashes?: string[] }[];
  replyTo?: { messageId: string; preview: string };
  senderHash?: string | null;
}

export async function fetchMessages(slug: string, clientId?: string): Promise<MessageData[]> {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;
  const { data } = await api.get(`/api/rooms/${slug}/messages`, { headers });
  return data.messages || [];
}

export async function sendMessage(
  slug: string,
  content: string,
  tempId: string,
  senderHash: string | null,
  replyTo?: { messageId: string; preview: string }
) {
  const { data } = await api.post(`/api/rooms/${slug}/messages`, {
    content,
    tempId,
    senderHash,
    ...(replyTo && { replyTo }),
  });
  return data;
}

export async function toggleReaction(
  slug: string,
  messageId: string,
  emoji: string,
  action: 'add' | 'remove',
  clientId: string
) {
  const { data } = await api.post(
    `/api/rooms/${slug}/messages/${messageId}/reactions`,
    { emoji, action },
    { headers: { 'x-client-id': clientId } }
  );
  return data;
}

// ── Ably Auth ─────────────────────────────────────────────────────────────────

export async function getAblyToken(clientId: string) {
  const { data } = await api.get(`/api/ably-auth?clientId=${encodeURIComponent(clientId)}`);
  return data;
}

export { api, BASE_URL };
