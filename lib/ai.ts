import { cloneWorld, simulateToRest, type World } from '@/shared/physics';
import { applyFlick, sanitizeFlick, type Flick } from '@/shared/game';

export type Level = 'easy' | 'normal' | 'hard';
const CFG: Record<Level, { n: number; err: number; perr: number }> = {
  easy: { n: 6, err: 0.2, perr: 0.2 },
  normal: { n: 26, err: 0.07, perr: 0.07 },
  hard: { n: 64, err: 0.015, perr: 0.02 },
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

/**
 * The AI tries many candidate flicks on a copy of the world using the SAME physics as the real game,
 * scores the outcomes, picks the best, then adds a human-like aiming error that depends on difficulty.
 */
export function chooseFlick(world: World, me: 0 | 1, level: Level): Flick {
  const cfg = CFG[level];
  const mine = world.pens[me], opp = world.pens[1 - me];
  const base = Math.atan2(opp.y - mine.y, opp.x - mine.x);
  const edge = (p: { x: number; y: number }) => Math.min(world.table.width / 2 - Math.abs(p.x), world.table.depth / 2 - Math.abs(p.y));

  let best = { a: base, power: 0.6, spin: 0, score: -1e9 };
  for (let i = 0; i < cfg.n; i++) {
    const a = base + (i === 0 ? 0 : gauss() * (i % 5 === 0 ? 0.6 : 0.25));
    const power = i === 0 ? 0.8 : 0.3 + Math.random() * 0.7;
    const spin = i < 2 ? 0 : (Math.random() - 0.5) * 0.5;
    const w = cloneWorld(world);
    applyFlick(w, me, { dx: Math.cos(a), dy: Math.sin(a), power, spin });
    simulateToRest(w, 8);
    const m = w.pens[me], o = w.pens[1 - me];
    let s: number;
    if (m.fallen) s = -1000;
    else if (o.fallen) s = 1000 + w.heavy * 5;
    else s = (60 - edge(o)) + Math.min(edge(m), 25) * 0.9 + w.hits * 3;
    if (s > best.score) best = { a, power, spin, score: s };
  }
  const a = best.a + (Math.random() - 0.5) * 2 * cfg.err;
  const power = Math.min(1, Math.max(0.1, best.power * (1 + (Math.random() - 0.5) * 2 * cfg.perr)));
  return sanitizeFlick({ dx: Math.cos(a), dy: Math.sin(a), power, spin: best.spin })!;
}
