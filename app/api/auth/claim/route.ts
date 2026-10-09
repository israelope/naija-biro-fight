import { handle, readJson, HttpError } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { requireUid } from '@/lib/server/session';
import { loadProfile } from '@/lib/server/profile';
import { hashPin } from '@/lib/server/pin';
import { USERNAME_RE } from '@/shared/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Turns a guest into a named profile. A 4-6 digit PIN lets you sign in on another device later.
export const POST = handle(async (req) => {
  const uid = await requireUid();
  const b = await readJson(req);
  const username = String(b.username ?? '').trim();
  const pin = String(b.pin ?? '');
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'BAD_USERNAME', 'Username must be 3-15 letters, numbers or underscores.');
  if (!/^\d{4,6}$/.test(pin)) throw new HttpError(400, 'BAD_PIN', 'PIN must be 4 to 6 digits.');
  if (!b.agree) throw new HttpError(400, 'NOT_AGREED', 'Please confirm you are 13+ and accept the Terms.');
  const avatar = Math.max(0, Math.min(11, Number(b.avatar) | 0));
  const school = b.school ? String(b.school).slice(0, 60) : null;
  const state = b.state ? String(b.state).slice(0, 30) : null;
  const { salt, hash } = hashPin(pin);
  try {
    const r = (await db()`
      UPDATE users SET username = ${username}, avatar = ${avatar}, school = ${school}, state = ${state},
             pin_hash = ${hash}, pin_salt = ${salt}
      WHERE id = ${uid} AND username IS NULL RETURNING id`) as Row[];
    if (!r.length) throw new HttpError(409, 'ALREADY_CLAIMED', 'This profile already has a username.');
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    if (String(e?.message).includes('users_username_lower') || e?.code === '23505') throw new HttpError(409, 'USERNAME_TAKEN', 'That username is taken, try another.');
    throw e;
  }
  return await loadProfile(uid);
});
