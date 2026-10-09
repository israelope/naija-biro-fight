import { handle, readJson } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { requireUid } from '@/lib/server/session';
import { loadProfile } from '@/lib/server/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const uid = await requireUid();
  const b = await readJson(req);
  const avatar = Math.max(0, Math.min(11, Number(b.avatar) | 0));
  const school = b.school ? String(b.school).slice(0, 60) : null;
  const state = b.state ? String(b.state).slice(0, 30) : null;
  await db()`UPDATE users SET avatar = ${avatar}, school = ${school}, state = ${state} WHERE id = ${uid}`;
  return await loadProfile(uid);
});
