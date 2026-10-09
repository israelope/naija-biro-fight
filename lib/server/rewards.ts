import { db, type Row } from './db';
import { REWARDS } from '@/shared/constants';

interface AwardOpts { won: boolean; heavy: number; source: 'ai' | 'pvp'; forfeit?: boolean; multiplier?: number; pvpRecord?: boolean }

/**
 * Pays out match coins with daily caps, and updates win/loss counters.
 * Returns the coins actually granted (may be 0 once the daily cap is reached).
 */
export async function awardCoins(uid: string, o: AwardOpts): Promise<number> {
  const sql = db();
  const rows = (await sql`
    SELECT earned_today, ai_earned_today, earn_date::text AS earn_date, first_match_date::text AS fm,
           ((now() AT TIME ZONE 'Africa/Lagos')::date)::text AS today
    FROM users WHERE id = ${uid}`) as Row[];
  const u = rows[0];
  if (!u) return 0;
  const sameDay = u.earn_date === u.today;
  const earned = sameDay ? (u.earned_today as number) : 0;
  const aiEarned = sameDay ? (u.ai_earned_today as number) : 0;

  let raw: number;
  if (o.source === 'ai') raw = (o.won ? REWARDS.aiWin : REWARDS.aiLoss) + Math.min(o.heavy, 10) * REWARDS.aiHeavyEach;
  else if (o.forfeit) raw = o.won ? REWARDS.forfeitWin : 0;
  else raw = (o.won ? REWARDS.pvpWin : REWARDS.pvpLoss) + Math.min(o.heavy * REWARDS.heavyEach, REWARDS.heavyMax);
  if (u.fm !== u.today && !(o.forfeit && !o.won)) raw += REWARDS.firstMatchBonus;
  raw = Math.round(raw * (o.multiplier ?? 1));

  let award = Math.min(raw, Math.max(0, REWARDS.dailyCap - earned));
  if (o.source === 'ai') award = Math.min(award, Math.max(0, REWARDS.aiDailyCap - aiEarned));
  const aiAward = o.source === 'ai' ? award : 0;
  const win = o.source === 'pvp' && o.won ? 1 : 0;
  const loss = o.source === 'pvp' && !o.won ? 1 : 0;
  const aiWin = o.source === 'ai' && o.won ? 1 : 0;

  await sql`
    UPDATE users SET
      coins = coins + ${award},
      earned_today = ${earned + award},
      ai_earned_today = ${aiEarned + aiAward},
      earn_date = ${u.today}::date,
      first_match_date = ${u.today}::date,
      wins = wins + ${win}, losses = losses + ${loss}, ai_wins = ai_wins + ${aiWin},
      heavy_moves = heavy_moves + ${o.source === 'pvp' ? o.heavy : 0}
    WHERE id = ${uid}`;
  return award;
}
