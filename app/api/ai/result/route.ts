import { handle, readJson } from '@/lib/server/http';
import { requireUid } from '@/lib/server/session';
import { loadProfile } from '@/lib/server/profile';
import { awardCoins } from '@/lib/server/rewards';
import { rateLimit } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Practice-mode results are reported by the browser, so they are low value and capped per day.
export const POST = handle(async (req) => {
  const uid = await requireUid();
  rateLimit('ai:' + uid, 20, 60 * 60 * 1000);
  const b = await readJson(req);
  const coins = await awardCoins(uid, { source: 'ai', won: !!b.won, heavy: Math.max(0, Math.min(10, Number(b.heavy) | 0)) });
  return { coins, profile: await loadProfile(uid) };
});
