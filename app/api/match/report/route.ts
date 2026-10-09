import { handle, HttpError, secret } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { awardCoins } from '@/lib/server/rewards';
import { verifyHex } from '@/shared/sign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called by the Cloudflare room server (never by browsers) when a match ends.
// The body is signed with GAME_SECRET, and the match id makes the call idempotent.
export const POST = handle(async (req) => {
  const raw = await req.text();
  const ok = await verifyHex(raw, req.headers.get('x-signature') ?? '', secret());
  if (!ok) throw new HttpError(401, 'BAD_SIGNATURE', 'Bad signature');
  const b = JSON.parse(raw);
  const a = String(b.p1), c = String(b.p2);
  const winner = b.winner === 1 ? 1 : 0;
  if (a === c) throw new HttpError(400, 'SAME_PLAYER', 'A player cannot play themselves');
  const sql = db();

  const inserted = (await sql`
    INSERT INTO matches (id, room_code, player1_id, player2_id, winner_id, score1, score2, heavy1, heavy2, forfeit)
    VALUES (${b.matchId}, ${b.code}, ${a}, ${c}, ${winner === 0 ? a : c},
            ${b.score[0] | 0}, ${b.score[1] | 0}, ${b.heavy[0] | 0}, ${b.heavy[1] | 0}, ${!!b.forfeit})
    ON CONFLICT (id) DO NOTHING RETURNING id`) as Row[];
  if (!inserted.length) {
    const prev = (await sql`SELECT coins1, coins2 FROM matches WHERE id = ${b.matchId}`) as Row[];
    return { rewards: [prev[0]?.coins1 ?? 0, prev[0]?.coins2 ?? 0], duplicate: true };
  }

  // Farming guard: playing the same opponent over and over pays much less.
  const pair = (await sql`
    SELECT count(*)::int AS n FROM matches
    WHERE created_at > now() - interval '24 hours' AND id <> ${b.matchId}
      AND ((player1_id = ${a} AND player2_id = ${c}) OR (player1_id = ${c} AND player2_id = ${a}))`) as Row[];
  const multiplier = (pair[0]?.n ?? 0) >= 6 ? 0.25 : 1;

  const [c1, c2] = await Promise.all([
    awardCoins(a, { source: 'pvp', won: winner === 0, heavy: b.heavy[0] | 0, forfeit: !!b.forfeit, multiplier }),
    awardCoins(c, { source: 'pvp', won: winner === 1, heavy: b.heavy[1] | 0, forfeit: !!b.forfeit, multiplier }),
  ]);
  await sql`UPDATE matches SET coins1 = ${c1}, coins2 = ${c2} WHERE id = ${b.matchId}`;
  return { rewards: [c1, c2] };
});
