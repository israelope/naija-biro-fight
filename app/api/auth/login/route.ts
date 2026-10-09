import { handle, readJson, HttpError } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { setSession } from '@/lib/server/session';
import { loadProfile } from '@/lib/server/profile';
import { checkPin } from '@/lib/server/pin';
import { rateLimit, clientIp } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  rateLimit('login:' + clientIp(req), 12, 15 * 60 * 1000);
  const b = await readJson(req);
  const username = String(b.username ?? '').trim();
  const pin = String(b.pin ?? '');
  const rows = (await db()`
    SELECT id, pin_hash, pin_salt, failed_attempts, (locked_until IS NOT NULL AND locked_until > now()) AS locked
    FROM users WHERE lower(username) = lower(${username})`) as Row[];
  const u = rows[0];
  const bad = new HttpError(401, 'BAD_LOGIN', 'Wrong username or PIN.');
  if (!u || !u.pin_hash) throw bad;
  if (u.locked) throw new HttpError(429, 'LOCKED', 'Too many wrong tries. Try again in 15 minutes.');
  if (!checkPin(pin, u.pin_salt, u.pin_hash)) {
    // 5 wrong PINs locks the account for 15 minutes.
    await db()`UPDATE users SET
      locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END,
      failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END
      WHERE id = ${u.id}`;
    throw bad;
  }
  await db()`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${u.id}`;
  await setSession(u.id);
  return await loadProfile(u.id);
});
