import type { Loadout } from './catalog';
import type { Flick, Snap } from './game';

export interface PlayerPub { uid: string; name: string; avatar: number; loadout: Loadout }

export type ClientMsg =
  | { t: 'flick'; f: Flick }
  | { t: 'emote'; id: number }
  | { t: 'rematch' }
  | { t: 'ping' };

export interface Outcome {
  roundWinner: 0 | 1 | null;
  score: [number, number];
  turn: 0 | 1 | null;           // whose turn is next (null when the round or match ended)
  heavy: [number, number];      // running heavy-move totals for the match
  matchWinner: 0 | 1 | null;
}

export type ServerMsg =
  | { t: 'hello'; code: string; you: 0 | 1; tableId: string; bestOf: number; players: (PlayerPub | null)[]; status: string }
  | { t: 'round'; round: number; turn: 0 | 1; score: [number, number]; snap: Snap; timeMs: number; heavy: [number, number]; countdown?: boolean }
  | { t: 'flick'; side: 0 | 1; f: Flick; final: Snap; out: Outcome; animMs: number; timeMs: number }
  | { t: 'turn'; turn: 0 | 1; timeMs: number; skipped?: boolean }
  | { t: 'opp'; connected: boolean; graceMs?: number }
  | { t: 'matchEnd'; winner: 0 | 1; score: [number, number]; heavy: [number, number]; rewards: (number | null)[]; forfeit?: boolean }
  | { t: 'emote'; side: 0 | 1; id: number }
  | { t: 'rematch'; side: 0 | 1 }
  | { t: 'error'; code: string; msg: string }
  | { t: 'pong' };
