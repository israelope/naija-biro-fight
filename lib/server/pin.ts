import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return { salt, hash };
}

export function checkPin(pin: string, salt: string, hash: string): boolean {
  const a = Buffer.from(scryptSync(pin, salt, 32).toString('hex'));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
