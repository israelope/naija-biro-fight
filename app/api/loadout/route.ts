import { handle, readJson } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { requireUid } from '@/lib/server/session';
import { loadProfile, getOwned } from '@/lib/server/profile';
import { sanitizeLoadout, sanitizeTable } from '@/shared/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Saves the equipped pen parts + table. Anything the player does not own silently falls back to the free default.
export const POST = handle(async (req) => {
  const uid = await requireUid();
  const b = await readJson(req);
  const owned = await getOwned(uid);
  const loadout = sanitizeLoadout(b.loadout, owned);
  const tableId = sanitizeTable(b.tableId, owned);
  await db()`UPDATE users SET loadout = ${JSON.stringify(loadout)}::jsonb, table_id = ${tableId} WHERE id = ${uid}`;
  return await loadProfile(uid);
});
