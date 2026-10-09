import { handle } from '@/lib/server/http';
import { clearSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async () => {
  clearSession();
  return { ok: true };
});
