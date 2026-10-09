import { NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}

type Handler = (req: Request, ctx: any) => Promise<any>;

/** Wraps a route handler: returns JSON, converts HttpError into proper status codes. */
export function handle(fn: Handler) {
  return async (req: Request, ctx: any) => {
    try {
      const data = await fn(req, ctx);
      return NextResponse.json(data ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e: any) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
      console.error('API error:', e);
      return NextResponse.json({ error: 'SERVER_ERROR', message: 'Something went wrong.' }, { status: 500 });
    }
  };
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new HttpError(400, 'BAD_JSON', 'Invalid request body'); }
}

export function secret(): string {
  const s = process.env.GAME_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'SECRET_MISSING', 'GAME_SECRET is not configured');
  return 'dev-secret-change-me';
}
