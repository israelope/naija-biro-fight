// Tiny HMAC token helpers built on Web Crypto (works in Node 20, Cloudflare Workers and browsers).
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str: string): Uint8Array {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function hmacBytes(data: string, secret: string): Promise<Uint8Array> {
  const key = await hmacKey(secret);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function hmacHex(data: string, secret: string): Promise<string> {
  return Array.from(await hmacBytes(data, secret)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyHex(data: string, sig: string, secret: string): Promise<boolean> {
  return safeEqual(await hmacHex(data, secret), sig || '');
}

/** payload + expiry (seconds from now), signed. */
export async function signToken(payload: Record<string, unknown>, secret: string, ttlSeconds: number): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = b64url(await hmacBytes(body, secret));
  return `${body}.${sig}`;
}

export async function verifyToken<T = any>(token: string | undefined | null, secret: string): Promise<T | null> {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = b64url(await hmacBytes(body, secret));
  if (!safeEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(dec.decode(unb64url(body)));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    return payload as T;
  } catch {
    return null;
  }
}
