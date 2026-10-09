import { db, type Row } from './db';
import { HttpError } from './http';
import { FREE_ITEM_IDS, normalizeLoadout, sanitizeLoadout, sanitizeTable } from '@/shared/catalog';

export interface HistoryRow { id: string; at: string; won: boolean; opponent: string; myScore: number; theirScore: number; coins: number }

/** Full profile payload the client needs on load. */
export async function loadProfile(uid: string) {
  const sql = db();
  const rows = (await sql`
    SELECT id, username, avatar, school, state, coins, wins, losses, ai_wins, heavy_moves, streak,
           loadout, table_id, banned, (pin_hash IS NOT NULL) AS has_pin,
           ((now() AT TIME ZONE 'Africa/Lagos')::date)::text AS today, last_daily::text AS last_daily
    FROM users WHERE id = ${uid}`) as Row[];
  const u = rows[0];
  if (!u) throw new HttpError(401, 'NO_SESSION', 'Account not found');
  if (u.banned) throw new HttpError(403, 'BANNED', 'This account has been suspended.');

  const inv = (await sql`SELECT item_id FROM inventory WHERE user_id = ${uid}`) as Row[];
  const owned = [...new Set([...FREE_ITEM_IDS, ...inv.map((r) => r.item_id as string)])];

  const hist = (await sql`
    SELECT m.id, m.created_at::text AS at, (m.winner_id = ${uid}) AS won,
           (m.player1_id = ${uid}) AS is_p1, m.score1, m.score2, m.coins1, m.coins2,
           COALESCE(ou.username, 'Guest') AS opponent
    FROM matches m
    LEFT JOIN users ou ON ou.id = CASE WHEN m.player1_id = ${uid} THEN m.player2_id ELSE m.player1_id END
    WHERE m.player1_id = ${uid} OR m.player2_id = ${uid}
    ORDER BY m.created_at DESC LIMIT 15`) as Row[];

  sql`UPDATE users SET last_seen = now() WHERE id = ${uid}`.catch(() => {});

  return {
    id: u.id as string,
    username: (u.username as string | null) ?? null,
    guest: !u.username,
    hasPin: !!u.has_pin,
    avatar: u.avatar as number,
    school: (u.school as string | null) ?? null,
    state: (u.state as string | null) ?? null,
    coins: u.coins as number,
    wins: u.wins as number,
    losses: u.losses as number,
    aiWins: u.ai_wins as number,
    heavyMoves: u.heavy_moves as number,
    streak: u.streak as number,
    dailyAvailable: u.last_daily !== u.today,
    owned,
    loadout: sanitizeLoadout(normalizeLoadout(u.loadout), owned),
    tableId: sanitizeTable(u.table_id as string, owned),
    history: hist.map<HistoryRow>((h) => ({
      id: h.id, at: h.at, won: !!h.won, opponent: h.opponent,
      myScore: h.is_p1 ? h.score1 : h.score2, theirScore: h.is_p1 ? h.score2 : h.score1,
      coins: h.is_p1 ? h.coins1 : h.coins2,
    })),
  };
}

export async function getOwned(uid: string): Promise<string[]> {
  const inv = (await db()`SELECT item_id FROM inventory WHERE user_id = ${uid}`) as Row[];
  return [...new Set([...FREE_ITEM_IDS, ...inv.map((r) => r.item_id as string)])];
}
