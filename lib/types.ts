import type { Loadout } from '@/shared/catalog';

export interface HistoryRow { id: string; at: string; won: boolean; opponent: string; myScore: number; theirScore: number; coins: number }

export interface Profile {
  id: string;
  username: string | null;
  guest: boolean;
  hasPin: boolean;
  avatar: number;
  school: string | null;
  state: string | null;
  coins: number;
  wins: number;
  losses: number;
  aiWins: number;
  heavyMoves: number;
  streak: number;
  dailyAvailable: boolean;
  owned: string[];
  loadout: Loadout;
  tableId: string;
  history: HistoryRow[];
  offline?: boolean;
}
