import { handle, readJson, HttpError } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { requireUid } from '@/lib/server/session';
import { rateLimit } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REASONS = ['abusive', 'cheating', 'inappropriate-name', 'other'];

export const POST = handle(async (req) => {
  const uid = await requireUid();
  rateLimit('report:' + uid, 5, 60 * 60 * 1000);
  const b = await readJson(req);
  const name = String(b.name ?? '').slice(0, 40);
  const reason = REASONS.includes(b.reason) ? b.reason : 'other';
  const note = b.note ? String(b.note).slice(0, 300) : null;
  if (!name) throw new HttpError(400, 'NO_NAME', 'Who are you reporting?');
  await db()`INSERT INTO reports (reporter_id, reported_name, reason, note) VALUES (${uid}, ${name}, ${reason}, ${note})`;
  return { ok: true };
});
