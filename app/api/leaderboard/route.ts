import { handle } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { getUid } from '@/lib/server/session';
import { NG_STATES } from '@/shared/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') === 'week' ? 'week' : 'all';
  const st = url.searchParams.get('state');
  const state = st && NG_STATES.includes(st) ? st : null;
  const sql = db();
  let rows: Row[];
  if (scope === 'week') {
    rows = (await sql`
      SELECT u.username, u.avatar, u.state, u.school, count(*)::int AS wins
      FROM matches m JOIN users u ON u.id = m.winner_id
      WHERE m.created_at > now() - interval '7 days' AND u.username IS NOT NULL AND u.banned = false
        AND (${state}::text IS NULL OR u.state = ${state})
      GROUP BY u.id ORDER BY wins DESC, u.username LIMIT 50`) as Row[];
  } else {
    rows = (await sql`
      SELECT username, avatar, state, school, wins
      FROM users WHERE username IS NOT NULL AND banned = false AND wins > 0
        AND (${state}::text IS NULL OR state = ${state})
      ORDER BY wins DESC, heavy_moves DESC, username LIMIT 50`) as Row[];
  }
  let me: string | null = null;
  const uid = await getUid();
  if (uid) { const r = (await sql`SELECT username FROM users WHERE id = ${uid}`) as Row[]; me = r[0]?.username ?? null; }
  return { scope, state, me, rows };
});
