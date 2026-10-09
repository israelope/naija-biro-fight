// Optional helper:  npm run db:init   (needs Node 20.6+ and DATABASE_URL in .env.local)
// Easier alternative: paste db/schema.sql into the Neon SQL Editor.
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (put it in .env.local)'); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);
const text = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const statements = text.split(';').map((s) => s.trim()).filter(Boolean);
for (const st of statements) {
  await sql.query(st);
  console.log('ok:', st.split('\n')[0].slice(0, 70));
}
console.log('\nDatabase ready.');
