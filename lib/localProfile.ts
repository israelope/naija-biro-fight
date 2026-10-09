// Offline profile saved in this browser (used when the database is not configured, or there is no network).
import { DEFAULT_LOADOUT, DEFAULT_TABLE, FREE_ITEM_IDS, ITEMS, sanitizeLoadout, sanitizeTable, type Loadout } from '@/shared/catalog';
import { REWARDS } from '@/shared/constants';
import type { Profile } from './types';

const KEY = 'nbf_local_v1';
interface Meta { lastDaily: string; aiDate: string; aiEarned: number }
interface Saved { p: Profile; m: Meta }

const lagosDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const yesterday = () => lagosDay(new Date(Date.now() - 86400000));

function fresh(): Saved {
  return {
    p: { id: 'local', username: null, guest: true, hasPin: false, avatar: Math.floor(Math.random() * 12), school: null, state: null, coins: 100,
      wins: 0, losses: 0, aiWins: 0, heavyMoves: 0, streak: 0, dailyAvailable: true, owned: [...FREE_ITEM_IDS], loadout: { ...DEFAULT_LOADOUT },
      tableId: DEFAULT_TABLE, history: [], offline: true },
    m: { lastDaily: '', aiDate: '', aiEarned: 0 },
  };
}
function read(): Saved {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as Saved; } catch {}
  return fresh();
}
function write(s: Saved): Profile {
  s.p.dailyAvailable = s.m.lastDaily !== lagosDay();
  s.p.offline = true;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  return { ...s.p };
}

export const local = {
  get: () => write(read()),
  claim(b: { username: string; avatar: number; school?: string; state?: string }) {
    const s = read(); Object.assign(s.p, { username: b.username, guest: false, avatar: b.avatar, school: b.school || null, state: b.state || null }); return write(s);
  },
  saveProfile(b: { avatar: number; school?: string | null; state?: string | null }) {
    const s = read(); Object.assign(s.p, { avatar: b.avatar, school: b.school ?? null, state: b.state ?? null }); return write(s);
  },
  saveLoadout(loadout: Loadout, tableId: string) {
    const s = read(); s.p.loadout = sanitizeLoadout(loadout, s.p.owned); s.p.tableId = sanitizeTable(tableId, s.p.owned); return write(s);
  },
  buy(itemId: string) {
    const s = read(); const it = ITEMS[itemId];
    if (!it || it.price === 0 || s.p.owned.includes(itemId)) throw new Error('Cannot buy that.');
    if (s.p.coins < it.price) throw new Error('Not enough coins.');
    s.p.coins -= it.price; s.p.owned.push(itemId); return write(s);
  },
  daily() {
    const s = read(); const today = lagosDay();
    if (s.m.lastDaily === today) throw new Error('Already claimed today.');
    const streak = s.m.lastDaily === yesterday() ? Math.min(s.p.streak + 1, REWARDS.dailyMaxStreak) : 1;
    const reward = REWARDS.dailyBase + REWARDS.dailyStep * (streak - 1);
    s.p.coins += reward; s.p.streak = streak; s.m.lastDaily = today;
    return { reward, streak, profile: write(s) };
  },
  aiResult(won: boolean, heavy: number) {
    const s = read(); const today = lagosDay();
    if (s.m.aiDate !== today) { s.m.aiDate = today; s.m.aiEarned = 0; }
    const raw = (won ? REWARDS.aiWin : REWARDS.aiLoss) + Math.min(heavy, 10) * REWARDS.aiHeavyEach;
    const coins = Math.min(raw, Math.max(0, REWARDS.aiDailyCap - s.m.aiEarned));
    s.m.aiEarned += coins; s.p.coins += coins; if (won) s.p.aiWins++;
    return { coins, profile: write(s) };
  },
};
