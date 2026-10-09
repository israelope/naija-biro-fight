// Deterministic 2D rigid-body physics for pens (capsules) sliding on a table.
// IMPORTANT: only + - * / and sqrt are used inside the simulation, because those are
// bit-exact in every JavaScript engine. That is what lets the phone, the opponent's phone
// and the room server all replay the same flick and get the same result.

export const G = 980;              // cm/s^2
export const FIXED_DT = 1 / 120;   // seconds per simulation step
export const HEAVY_SPEED = 85;     // impact speed (cm/s) that counts as a "heavy move"
export const ANG_FRIC = 55;        // angular friction scale

export interface PenSpec {
  length: number; radius: number; mass: number; restitution: number;
  grip: number; spin: number; maxSpeed: number;
}
export interface TableSpec { width: number; depth: number; friction: number }

export interface Pen {
  owner: 0 | 1; spec: PenSpec;
  x: number; y: number; vx: number; vy: number;
  dx: number; dy: number;          // unit vector pointing at the nib
  w: number;                       // angular velocity (rad/s)
  fallen: boolean;
}
export interface HitEvent { a: number; b: number; speed: number; x: number; y: number }
export interface World {
  table: TableSpec; pens: Pen[]; t: number;
  heavy: number; hits: number; lastHeavyT: number;
  record: boolean; events: HitEvent[];
}

export function makePen(owner: 0 | 1, spec: PenSpec): Pen {
  return { owner, spec, x: 0, y: 0, vx: 0, vy: 0, dx: 1, dy: 0, w: 0, fallen: false };
}
export function makeWorld(table: TableSpec, pens: Pen[], record = false): World {
  return { table, pens, t: 0, heavy: 0, hits: 0, lastHeavyT: -1, record, events: [] };
}
export function cloneWorld(w: World): World {
  return { ...w, events: [], record: false, pens: w.pens.map((p) => ({ ...p })) };
}

export function isAtRest(w: World): boolean {
  for (const p of w.pens) {
    if (p.fallen) continue;
    if (p.vx * p.vx + p.vy * p.vy > 0.25 || Math.abs(p.w) > 0.02) return false;
  }
  return true;
}

const cs = { ax: 0, ay: 0, bx: 0, by: 0 };
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Closest points between segments p1-q1 and p2-q2 (Ericson, Real-Time Collision Detection).
function closest(p1x: number, p1y: number, q1x: number, q1y: number, p2x: number, p2y: number, q2x: number, q2y: number) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y;
  const rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  const EPS = 1e-9;
  let s = 0, t = 0;
  if (a <= EPS && e <= EPS) { s = 0; t = 0; }
  else if (a <= EPS) { s = 0; t = clamp01(f / e); }
  else {
    const c = d1x * rx + d1y * ry;
    if (e <= EPS) { t = 0; s = clamp01(-c / a); }
    else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  cs.ax = p1x + d1x * s; cs.ay = p1y + d1y * s;
  cs.bx = p2x + d2x * t; cs.by = p2y + d2y * t;
}

function collide(w: World, ia: number, ib: number) {
  const A = w.pens[ia], B = w.pens[ib];
  if (A.fallen || B.fallen) return;
  const ha = Math.max(0, A.spec.length * 0.5 - A.spec.radius);
  const hb = Math.max(0, B.spec.length * 0.5 - B.spec.radius);
  closest(A.x - A.dx * ha, A.y - A.dy * ha, A.x + A.dx * ha, A.y + A.dy * ha,
          B.x - B.dx * hb, B.y - B.dy * hb, B.x + B.dx * hb, B.y + B.dy * hb);
  let nx = cs.bx - cs.ax, ny = cs.by - cs.ay;
  const rs = A.spec.radius + B.spec.radius;
  const d2 = nx * nx + ny * ny;
  if (d2 >= rs * rs) return;
  let d = Math.sqrt(d2);
  if (d > 1e-9) { nx /= d; ny /= d; } else { nx = -A.dy; ny = A.dx; d = 0; }
  const pen = rs - d;

  const cx = cs.ax + nx * A.spec.radius, cy = cs.ay + ny * A.spec.radius;
  const rax = cx - A.x, ray = cy - A.y, rbx = cx - B.x, rby = cy - B.y;
  const ma = A.spec.mass, mb = B.spec.mass;
  const Ia = (ma * A.spec.length * A.spec.length) / 12, Ib = (mb * B.spec.length * B.spec.length) / 12;

  let rvx = (B.vx - B.w * rby) - (A.vx - A.w * ray);
  let rvy = (B.vy + B.w * rbx) - (A.vy + A.w * rax);
  const vn = rvx * nx + rvy * ny;

  if (vn < 0) {
    const speed = -vn;
    const raxn = rax * ny - ray * nx, rbxn = rbx * ny - rby * nx;
    const k = 1 / ma + 1 / mb + (raxn * raxn) / Ia + (rbxn * rbxn) / Ib;
    const e = speed < 8 ? 0 : (A.spec.restitution + B.spec.restitution) * 0.5;
    const j = (-(1 + e) * vn) / k;
    A.vx -= (j * nx) / ma; A.vy -= (j * ny) / ma; A.w -= (raxn * j) / Ia;
    B.vx += (j * nx) / mb; B.vy += (j * ny) / mb; B.w += (rbxn * j) / Ib;

    // Tangential friction between the two pens (gives believable glancing spin).
    rvx = (B.vx - B.w * rby) - (A.vx - A.w * ray);
    rvy = (B.vy + B.w * rbx) - (A.vy + A.w * rax);
    const tx = -ny, ty = nx;
    const vt = rvx * tx + rvy * ty;
    const ratx = rax * ty - ray * tx, rbtx = rbx * ty - rby * tx;
    const kt = 1 / ma + 1 / mb + (ratx * ratx) / Ia + (rbtx * rbtx) / Ib;
    let jt = -vt / kt;
    const maxJt = 0.2 * j;
    if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
    A.vx -= (jt * tx) / ma; A.vy -= (jt * ty) / ma; A.w -= (ratx * jt) / Ia;
    B.vx += (jt * tx) / mb; B.vy += (jt * ty) / mb; B.w += (rbtx * jt) / Ib;

    w.hits++;
    if (speed >= HEAVY_SPEED && w.t - w.lastHeavyT > 0.25) { w.heavy++; w.lastHeavyT = w.t; }
    if (w.record && speed > 12 && w.events.length < 64) w.events.push({ a: ia, b: ib, speed, x: cx, y: cy });
  }

  // Push the pens apart, heavier pen moves less.
  const corr = Math.max(pen - 0.005, 0) * 0.8;
  const tm = ma + mb;
  A.x -= nx * corr * (mb / tm); A.y -= ny * corr * (mb / tm);
  B.x += nx * corr * (ma / tm); B.y += ny * corr * (ma / tm);
}

function subStep(w: World, h: number) {
  const pens = w.pens;
  for (const p of pens) {
    if (p.fallen) continue;
    const f = w.table.friction * p.spec.grip;
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > 0) {
      const dec = f * G * h;
      if (sp <= dec) { p.vx = 0; p.vy = 0; }
      else { const k = (sp - dec) / sp; p.vx *= k; p.vy *= k; }
    }
    if (p.w !== 0) {
      const ad = ANG_FRIC * f * h;
      if (Math.abs(p.w) <= ad) p.w = 0; else p.w += p.w > 0 ? -ad : ad;
    }
    p.x += p.vx * h; p.y += p.vy * h;
    if (p.w !== 0) {
      const a = p.w * h, c = 1 - a * a * 0.5;
      const nx = p.dx * c - p.dy * a, ny = p.dy * c + p.dx * a;
      const l = Math.sqrt(nx * nx + ny * ny);
      p.dx = nx / l; p.dy = ny / l;
    }
  }
  w.t += h;
  for (let i = 0; i < pens.length; i++) for (let j = i + 1; j < pens.length; j++) collide(w, i, j);
  const hx = w.table.width * 0.5, hy = w.table.depth * 0.5;
  for (const p of pens) {
    if (!p.fallen && (p.x > hx || p.x < -hx || p.y > hy || p.y < -hy)) p.fallen = true; // centre of mass left the table
  }
}

/** Advance the world by dt seconds, sub-stepping fast pens so they cannot tunnel through each other. */
export function stepWorld(w: World, dt: number = FIXED_DT): void {
  let vmax = 0;
  for (const p of w.pens) {
    if (p.fallen) continue;
    const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy) + Math.abs(p.w) * p.spec.length * 0.5;
    if (v > vmax) vmax = v;
  }
  let n = Math.ceil((vmax * dt * 2) / 0.5);
  if (n < 1) n = 1; else if (n > 16) n = 16;
  const h = dt / n;
  for (let i = 0; i < n; i++) subStep(w, h);
}

/** Run until everything stops (or maxSeconds). Returns simulated seconds. */
export function simulateToRest(w: World, maxSeconds = 15): number {
  const t0 = w.t;
  const maxSteps = Math.ceil(maxSeconds / FIXED_DT);
  for (let i = 0; i < maxSteps; i++) {
    stepWorld(w);
    if (isAtRest(w)) break;
  }
  return w.t - t0;
}
