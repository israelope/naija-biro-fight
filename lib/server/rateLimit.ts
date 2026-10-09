import { HttpError } from './http';

// Best-effort, in-memory limiter. On serverless each instance has its own memory, so this
// only blunts casual abuse. Use Upstash Redis or a DB counter if you need hard limits.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests, slow down a bit.');
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
