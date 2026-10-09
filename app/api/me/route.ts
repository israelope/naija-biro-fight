import { handle } from '@/lib/server/http';
import { requireUid } from '@/lib/server/session';
import { loadProfile } from '@/lib/server/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const uid = await requireUid();
  return await loadProfile(uid);
});
