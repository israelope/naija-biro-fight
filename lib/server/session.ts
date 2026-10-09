import { cookies } from 'next/headers';
import { signToken, verifyToken } from '@/shared/sign';
import { HttpError, secret } from './http';

const COOKIE = 'nbf_session';
const TTL = 60 * 60 * 24 * 90;

export async function getUid(): Promise<string | null> {
  const c = cookies().get(COOKIE)?.value;
  if (!c) return null;
  const p = await verifyToken<{ uid: string }>(c, secret());
  return p?.uid ?? null;
}

export async function requireUid(): Promise<string> {
  const uid = await getUid();
  if (!uid) throw new HttpError(401, 'NO_SESSION', 'Not signed in');
  return uid;
}

export async function setSession(uid: string) {
  const token = await signToken({ uid }, secret(), TTL);
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL });
}

export function clearSession() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
