import { handle, readJson, HttpError } from '@/lib/server/http';
import { db, type Row } from '@/lib/server/db';
import { requireUid } from '@/lib/server/session';
import { loadProfile, getOwned } from '@/lib/server/profile';
import { rateLimit } from '@/lib/server/rateLimit';
import { ITEMS } from '@/shared/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const uid = await requireUid();
  rateLimit('buy:' + uid, 30, 60 * 1000);
  const b = await readJson(req);
  const item = ITEMS[String(b.itemId)];
  if (!item) throw new HttpError(404, 'NO_ITEM', 'Unknown item.');
  if (item.price === 0) throw new HttpError(400, 'FREE_ITEM', 'That item is free, just equip it.');
  // One atomic statement: take the coins and grant the item together, or do neither.
  const rows = (await db()`
    WITH paid AS (
      UPDATE users SET coins = coins - ${item.price}
      WHERE id = ${uid} AND coins >= ${item.price}
        AND NOT EXISTS (SELECT 1 FROM inventory WHERE user_id = ${uid} AND item_id = ${item.id})
      RETURNING coins
    ), ins AS (
      INSERT INTO inventory (user_id, item_id) SELECT ${uid}, ${item.id} FROM paid RETURNING item_id
    )
    SELECT coins FROM paid`) as Row[];
  if (!rows.length) {
    const owned = await getOwned(uid);
    if (owned.includes(item.id)) throw new HttpError(409, 'OWNED', 'You already own this.');
    throw new HttpError(402, 'NO_COINS', 'Not enough coins.');
  }
  return await loadProfile(uid);
});
