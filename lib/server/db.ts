import { neon } from '@neondatabase/serverless';
import { HttpError } from './http';

let _sql: ReturnType<typeof neon> | null = null;

/** Neon serverless SQL tagged-template client. Throws a 503 if DATABASE_URL is missing (the web app then runs in offline mode). */
export function db() {
  if (!process.env.DATABASE_URL) throw new HttpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

export type Row = Record<string, any>;
