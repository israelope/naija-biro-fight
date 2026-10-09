// Match rules shared by the browser (practice mode + animation) and the room server (real matches).
import { makePen, makeWorld, stepWorld, simulateToRest, isAtRest, type PenSpec, type TableSpec, type World } from './physics';

export interface Flick { dx: number; dy: number; power: number; spin: number }
/** One number array per pen: x,y,vx,vy,dx,dy,w,fallen */
export type Snap = number[][];

export const MIN_POWER = 0.06;
export const SPIN_RATE = 16; // rad/s at full spin and full power

export function buildWorld(table: TableSpec, specs: [PenSpec, PenSpec], record = false): World {
  const w = makeWorld(table, [makePen(0, specs[0]), makePen(1, specs[1])], record);
  resetRound(w);
  return w;
}

/** Puts both pens back at their starting spots (called at the start of every round). */
export function resetRound(w: World): void {
  const hy = w.table.depth * 0.5;
  const set = (i: number, x: number, y: number) => {
    const p = w.pens[i];
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.w = 0; p.fallen = false;
    p.dx = 1; p.dy = 0;
  };
  set(0, -w.table.width * 0.12, -(hy - 16));
  set(1, w.table.width * 0.12, hy - 16);
  w.heavy = 0; w.hits = 0; w.lastHeavyT = -1; w.events.length = 0;
}

/** Validates untrusted input and normalises it so every machine gets identical numbers. */
export function sanitizeFlick(f: any): Flick | null {
  if (!f || typeof f !== 'object') return null;
  const dx = Number(f.dx), dy = Number(f.dy), power = Number(f.power), spin = Number(f.spin ?? 0);
  if (![dx, dy, power, spin].every(Number.isFinite)) return null;
  const l = Math.sqrt(dx * dx + dy * dy);
  if (l < 1e-6) return null;
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  const pw = Math.min(1, Math.max(0, power));
  if (pw < MIN_POWER) return null;
  return { dx: r4(dx / l), dy: r4(dy / l), power: r4(pw), spin: r4(Math.min(1, Math.max(-1, spin))) };
}

export function applyFlick(w: World, owner: 0 | 1, f: Flick): void {
  const p = w.pens[owner];
  const l = Math.sqrt(f.dx * f.dx + f.dy * f.dy);
  p.dx = f.dx / l; p.dy = f.dy / l;       // the pen is pointed where you flick it
  const sp = f.power * p.spec.maxSpeed;
  p.vx = p.dx * sp; p.vy = p.dy * sp;
  p.w = f.spin * f.power * SPIN_RATE * p.spec.spin;
  w.heavy = 0; w.hits = 0; w.lastHeavyT = -1;
}

/** Who won the round after `shooter` flicked? null = nobody fell, keep playing. */
export function judgeTurn(w: World, shooter: 0 | 1): 0 | 1 | null {
  if (w.pens[shooter].fallen) return (1 - shooter) as 0 | 1;   // knocked yourself off: you lose the round
  if (w.pens[1 - shooter].fallen) return shooter;
  return null;
}

export function snapshot(w: World): Snap {
  return w.pens.map((p) => [p.x, p.y, p.vx, p.vy, p.dx, p.dy, p.w, p.fallen ? 1 : 0]);
}
export function loadSnapshot(w: World, s: Snap): void {
  s.forEach((a, i) => {
    const p = w.pens[i];
    if (!p || !a) return;
    p.x = a[0]; p.y = a[1]; p.vx = a[2]; p.vy = a[3]; p.dx = a[4]; p.dy = a[5]; p.w = a[6]; p.fallen = a[7] === 1;
  });
}

export const roundsToWin = (bestOf: number) => Math.floor(bestOf / 2) + 1;

export { stepWorld, simulateToRest, isAtRest };
