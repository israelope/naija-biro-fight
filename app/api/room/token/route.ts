import { handle, readJson, HttpError, secret } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { requireUid } from '@/lib/server/session';
import { getOwned } from '@/lib/server/profile';
import { rateLimit } from '@/lib/server/rateLimit';
import { signToken } from '@/shared/sign';
import { sanitizeLoadout, sanitizeTable } from '@/shared/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L to avoid mix-ups

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Issues a short-lived signed ticket the room server trusts (name, loadout and table are all verified here).
export const POST = handle(async (req) => {
  const uid = await requireUid();
  rateLimit('room:' + uid, 20, 10 * 60 * 1000);
  const wsBase = process.env.GAME_WS_URL;
  if (!wsBase) throw new HttpError(503, 'ONLINE_NOT_CONFIGURED', 'Online rooms are not set up yet.');
  const b = await readJson(req);
  const create = !!b.create;
  const code = create ? newCode() : String(b.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) throw new HttpError(400, 'BAD_CODE', 'Room codes have 6 characters.');

  const rows = (await db()`SELECT username, avatar, loadout, table_id, banned FROM users WHERE id = ${uid}`) as Row[];
  const u = rows[0];
  if (!u) throw new HttpError(401, 'NO_SESSION', 'Not signed in');
  if (u.banned) throw new HttpError(403, 'BANNED', 'This account has been suspended.');
  const owned = await getOwned(uid);
  const payload = {
    uid,
    name: u.username ?? 'Guest' + uid.slice(0, 4).toUpperCase(),
    avatar: u.avatar,
    loadout: sanitizeLoadout(u.loadout, owned),
    tableId: sanitizeTable(u.table_id, owned),
    code,
    create,
  };
  const token = await signToken(payload, secret(), 2 * 60 * 60);
  const wsUrl = wsBase.replace(/\/+$/, '') + '/ws/' + code + '?token=' + encodeURIComponent(token);
  return { code, wsUrl };
});
