import { handle, HttpError } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { requireUid } from '@/lib/server/session';
import { loadProfile } from '@/lib/server/profile';
import { REWARDS } from '@/shared/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Daily login reward with a 7-day streak. Day boundaries use Nigerian time (Africa/Lagos).
export const POST = handle(async () => {
  const uid = await requireUid();
  const rows = (await db()`
    SELECT streak, last_daily::text AS last_daily,
           ((now() AT TIME ZONE 'Africa/Lagos')::date)::text AS today,
           (((now() AT TIME ZONE 'Africa/Lagos')::date) - 1)::text AS yesterday
    FROM users WHERE id = ${uid}`) as Row[];
  const u = rows[0];
  if (!u) throw new HttpError(401, 'NO_SESSION', 'Not signed in');
  if (u.last_daily === u.today) throw new HttpError(409, 'ALREADY', 'Already claimed today. Come back tomorrow!');
  const streak = u.last_daily === u.yesterday ? Math.min(u.streak + 1, REWARDS.dailyMaxStreak) : 1;
  const reward = REWARDS.dailyBase + REWARDS.dailyStep * (streak - 1);
  const r = (await db()`
    UPDATE users SET coins = coins + ${reward}, streak = ${streak}, last_daily = ${u.today}::date
    WHERE id = ${uid} AND (last_daily IS NULL OR last_daily::text <> ${u.today}) RETURNING coins`) as Row[];
  if (!r.length) throw new HttpError(409, 'ALREADY', 'Already claimed today.');
  return { reward, streak, profile: await loadProfile(uid) };
});
