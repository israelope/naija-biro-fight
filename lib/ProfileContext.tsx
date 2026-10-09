'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Loadout } from '@/shared/catalog';
import { remote, ApiError } from './api';
import { local } from './localProfile';
import type { Profile } from './types';
import { toast } from './toast';

type Mode = 'loading' | 'online' | 'offline';

interface Ctx {
  profile: Profile | null;
  mode: Mode;
  refresh(): Promise<void>;
  buy(id: string): Promise<boolean>;
  saveLoadout(l: Loadout, tableId: string): Promise<void>;
  claimDaily(): Promise<{ reward: number; streak: number } | null>;
  claimName(b: { username: string; pin: string; avatar: number; school?: string; state?: string; agree: boolean }): Promise<boolean>;
  saveProfile(b: { avatar: number; school?: string | null; state?: string | null }): Promise<void>;
  login(username: string, pin: string): Promise<boolean>;
  logout(): Promise<void>;
  aiResult(won: boolean, heavy: number): Promise<number>;
}

const C = createContext<Ctx>(null as unknown as Ctx);
export const useProfile = () => useContext(C);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<Mode>('loading');

  const goOffline = useCallback(() => { setMode('offline'); setProfile(local.get()); }, []);

  useEffect(() => {
    (async () => {
      try { setProfile(await remote.me()); setMode('online'); return; }
      catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) { goOffline(); return; }
      }
      try { setProfile(await remote.guest()); setMode('online'); }
      catch { goOffline(); }
    })();
  }, [goOffline]);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); }
    catch (e: any) { toast(e?.message || 'Something went wrong.', 'bad'); return null; }
  }, []);

  const value = useMemo<Ctx>(() => ({
    profile, mode,
    async refresh() { if (mode === 'offline') setProfile(local.get()); else { const p = await guard(remote.me); if (p) setProfile(p); } },
    async buy(id) {
      const p = await guard(async () => (mode === 'offline' ? local.buy(id) : remote.buy(id)));
      if (p) { setProfile(p); return true; } return false;
    },
    async saveLoadout(l, t) {
      const p = await guard(async () => (mode === 'offline' ? local.saveLoadout(l, t) : remote.saveLoadout(l, t)));
      if (p) setProfile(p);
    },
    async claimDaily() {
      const r = await guard(async () => (mode === 'offline' ? local.daily() : remote.daily()));
      if (r) { setProfile(r.profile); return { reward: r.reward, streak: r.streak }; } return null;
    },
    async claimName(b) {
      const p = await guard(async () => (mode === 'offline' ? local.claim(b) : remote.claim(b)));
      if (p) { setProfile(p); return true; } return false;
    },
    async saveProfile(b) {
      const p = await guard(async () => (mode === 'offline' ? local.saveProfile(b) : remote.saveProfile(b)));
      if (p) setProfile(p);
    },
    async login(u, pin) {
      const p = await guard(() => remote.login(u, pin));
      if (p) { setProfile(p); return true; } return false;
    },
    async logout() {
      if (mode === 'online') { await guard(remote.logout); const g = await guard(remote.guest); if (g) setProfile(g); }
    },
    async aiResult(won, heavy) {
      const r = await guard(async () => (mode === 'offline' ? local.aiResult(won, heavy) : remote.aiResult(won, heavy)));
      if (r) { setProfile(r.profile); return r.coins; } return 0;
    },
  }), [profile, mode, guard]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
