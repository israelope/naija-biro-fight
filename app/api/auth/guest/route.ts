import { handle } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { getUid, setSession } from '@/lib/server/session';
import { loadProfile } from '@/lib/server/profile';
import { rateLimit, clientIp } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Creates an anonymous guest account (no email / phone) and signs the browser in with a cookie.
export const POST = handle(async (req) => {
  const existing = await getUid();
  if (existing) { try { return await loadProfile(existing); } catch { /* fall through and make a new guest */ } }
  rateLimit('guest:' + clientIp(req), 10, 60 * 60 * 1000);
  const rows = (await db()`INSERT INTO users (avatar) VALUES (${Math.floor(Math.random() * 12)}) RETURNING id`) as Row[];
  const uid = rows[0].id as string;
  await setSession(uid);
  return await loadProfile(uid);
});
