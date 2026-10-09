import type { Loadout } from '@/shared/catalog';
import type { Profile } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function call<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No internet connection.');
  }
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error || 'ERROR', data.message || 'Something went wrong.');
  return data as T;
}

export const remote = {
  me: () => call<Profile>('/api/me'),
  guest: () => call<Profile>('/api/auth/guest', 'POST'),
  claim: (b: { username: string; pin: string; avatar: number; school?: string; state?: string; agree: boolean }) => call<Profile>('/api/auth/claim', 'POST', b),
  login: (username: string, pin: string) => call<Profile>('/api/auth/login', 'POST', { username, pin }),
  logout: () => call<{ ok: true }>('/api/auth/logout', 'POST'),
  saveProfile: (b: { avatar: number; school?: string | null; state?: string | null }) => call<Profile>('/api/profile', 'POST', b),
  saveLoadout: (loadout: Loadout, tableId: string) => call<Profile>('/api/loadout', 'POST', { loadout, tableId }),
  buy: (itemId: string) => call<Profile>('/api/shop/buy', 'POST', { itemId }),
  daily: () => call<{ reward: number; streak: number; profile: Profile }>('/api/daily', 'POST'),
  aiResult: (won: boolean, heavy: number) => call<{ coins: number; profile: Profile }>('/api/ai/result', 'POST', { won, heavy }),
  leaderboard: (scope: 'all' | 'week', state?: string) =>
    call<{ scope: string; me: string | null; rows: { username: string; avatar: number; state: string | null; school: string | null; wins: number }[] }>(
      `/api/leaderboard?scope=${scope}${state ? '&state=' + encodeURIComponent(state) : ''}`),
  report: (name: string, reason: string, note?: string) => call<{ ok: true }>('/api/report', 'POST', { name, reason, note }),
  roomToken: (b: { create?: boolean; code?: string }) => call<{ code: string; wsUrl: string }>('/api/room/token', 'POST', b),
};
