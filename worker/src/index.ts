// Naija Biro Fight - room server (Cloudflare Worker + Durable Objects).
// One Durable Object = one room. It keeps the authoritative game state, validates every flick,
// runs the same deterministic physics as the browser, and reports finished matches to the Vercel API.
import { verifyToken, hmacHex } from '../../shared/sign';
import { buildPenSpec, getTable, type Loadout } from '../../shared/catalog';
import { buildWorld, resetRound, applyFlick, sanitizeFlick, simulateToRest, judgeTurn, snapshot, roundsToWin } from '../../shared/game';
import type { World } from '../../shared/physics';
import type { ClientMsg, ServerMsg, PlayerPub, Outcome } from '../../shared/protocol';
import { TURN_SECONDS, BEST_OF } from '../../shared/constants';

export interface Env {
  ROOMS: DurableObjectNamespace;
  GAME_SECRET: string;
  API_URL: string;
  ALLOWED_ORIGINS?: string;
}

interface Claims { uid: string; name: string; avatar: number; loadout: Loadout; tableId: string; code: string; create: boolean }
interface Slot extends PlayerPub { ws: WebSocket | null; dcAt: number | null; afk: number; rematch: boolean; lastEmote: number }

const TURN_MS = TURN_SECONDS * 1000;
const GRACE_MS = 30_000;
const LOBBY_IDLE_MS = 15 * 60_000;
const OVER_IDLE_MS = 3 * 60_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response('Naija Biro Fight room server is running.');
    const m = url.pathname.match(/^\/ws\/([A-Za-z0-9]{6})$/);
    if (!m) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    if (allowed.length && (!origin || !allowed.includes(origin))) return new Response('Origin not allowed', { status: 403 });
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};

export class Room {
  private code = '';
  private created = false;
  private tableId = 'table-classroom';
  private slots: (Slot | null)[] = [null, null];
  private status: 'lobby' | 'countdown' | 'playing' | 'roundEnd' | 'ending' | 'over' = 'lobby';
  private world: World | null = null;
  private turn: 0 | 1 = 0;
  private firstShooter: 0 | 1 = 0;
  private score: [number, number] = [0, 0];
  private heavy: [number, number] = [0, 0];
  private round = 1;
  private bestOf = BEST_OF;
  private matchId = '';
  private startAt = 0;
  private turnDeadline = 0;
  private busyUntil = 0;
  private nextRoundAt = 0;
  private endAt = 0;
  private pendingWinner: 0 | 1 = 0;
  private pendingForfeit = false;
  private idleDeadline = 0;
  private lastEnd: ServerMsg | null = null;

  constructor(private state: DurableObjectState, private env: Env) {}

  // ---------------------------------------------------------------- connections
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.pathname.split('/').pop()!.toUpperCase();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();

    const claims = await verifyToken<Claims>(url.searchParams.get('token'), this.env.GAME_SECRET);
    const fail = (c: string, msg: string) => { this.raw(server, { t: 'error', code: c, msg }); try { server.close(4000, c); } catch {} };

    if (!claims || claims.code !== code) fail('BAD_TICKET', 'Your ticket is invalid or expired. Go back and try again.');
    else {
      let side = this.slots.findIndex((s) => s?.uid === claims.uid) as -1 | 0 | 1;
      if (side === -1) {
        if (!this.created) {
          if (!claims.create) { fail('NOT_FOUND', 'That room does not exist or has expired.'); return new Response(null, { status: 101, webSocket: client }); }
          this.created = true; this.code = code; this.tableId = claims.tableId;
        }
        side = this.slots[0] ? (this.slots[1] ? -1 : 1) : 0;
        if (side === -1) { fail('ROOM_FULL', 'This room already has two players.'); return new Response(null, { status: 101, webSocket: client }); }
        this.slots[side] = { uid: claims.uid, name: claims.name, avatar: claims.avatar, loadout: claims.loadout, ws: null, dcAt: null, afk: 0, rematch: false, lastEmote: 0 };
      }
      this.attach(side as 0 | 1, server);
    }
    await this.schedule();
    return new Response(null, { status: 101, webSocket: client });
  }

  private attach(side: 0 | 1, ws: WebSocket) {
    const slot = this.slots[side]!;
    if (slot.ws && slot.ws !== ws) { try { slot.ws.close(4001, 'replaced'); } catch {} }
    slot.ws = ws; slot.dcAt = null;
    ws.addEventListener('message', (e) => { void this.onMessage(side, ws, e.data); });
    ws.addEventListener('close', () => { void this.onClose(side, ws); });
    ws.addEventListener('error', () => { void this.onClose(side, ws); });
    this.touch();

    this.send(side, this.helloMsg(side));
    this.send((1 - side) as 0 | 1, { t: 'opp', connected: true });
    if (this.status === 'playing' || this.status === 'roundEnd' || this.status === 'ending') this.sendSync(side);
    else if (this.status === 'over' && this.lastEnd) this.send(side, this.lastEnd);
    else if (this.slots[0] && this.slots[1] && this.status === 'lobby') {
      this.status = 'countdown'; this.startAt = Date.now() + 3000;
      this.broadcast(this.helloMsg(0), this.helloMsg(1));
    }
  }

  private async onClose(side: 0 | 1, ws: WebSocket) {
    const slot = this.slots[side];
    if (!slot || slot.ws !== ws) return;
    slot.ws = null;
    if (this.status === 'lobby' || this.status === 'countdown') {
      if (side === 1) { this.slots[1] = null; this.status = 'lobby'; this.broadcast(this.helloMsg(0), this.helloMsg(1)); }
      else slot.dcAt = Date.now();
    } else slot.dcAt = Date.now();
    this.send((1 - side) as 0 | 1, { t: 'opp', connected: false, graceMs: GRACE_MS });
    this.touch();
    await this.schedule();
  }

  // ---------------------------------------------------------------- messages
  private async onMessage(side: 0 | 1, ws: WebSocket, data: unknown) {
    if (typeof data !== 'string' || data.length > 600) return;
    if (this.slots[side]?.ws !== ws) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(data); } catch { return; }
    const slot = this.slots[side]!;
    this.touch();

    switch (msg.t) {
      case 'ping': this.send(side, { t: 'pong' }); return;
      case 'emote': {
        const now = Date.now();
        if (now - slot.lastEmote < 1200 || !Number.isInteger(msg.id) || msg.id < 0 || msg.id > 7) return;
        slot.lastEmote = now;
        this.broadcast({ t: 'emote', side, id: msg.id }, { t: 'emote', side, id: msg.id });
        return;
      }
      case 'rematch': {
        if (this.status !== 'over') return;
        slot.rematch = true;
        this.send((1 - side) as 0 | 1, { t: 'rematch', side });
        if (this.slots[0]?.rematch && this.slots[1]?.rematch && this.slots[0].ws && this.slots[1].ws) this.startMatch();
        await this.schedule();
        return;
      }
      case 'flick': {
        if (this.status !== 'playing' || !this.world) return;
        if (side !== this.turn) { this.send(side, { t: 'error', code: 'NOT_YOUR_TURN', msg: 'Wait for your turn.' }); return; }
        const now = Date.now();
        if (now < this.busyUntil) return;
        const f = sanitizeFlick(msg.f);
        if (!f) { this.send(side, { t: 'error', code: 'BAD_FLICK', msg: 'That flick was not valid.' }); return; }
        slot.afk = 0;
        applyFlick(this.world, side, f);
        const simSec = simulateToRest(this.world);
        this.heavy[side] += this.world.heavy;
        const rw = judgeTurn(this.world, side);
        const animMs = Math.ceil(simSec * 1000) + 400;
        const out: Outcome = { roundWinner: rw, score: [...this.score], turn: null, heavy: [...this.heavy], matchWinner: null };
        if (rw !== null) {
          this.score[rw]++;
          out.score = [...this.score];
          if (this.score[rw] >= roundsToWin(this.bestOf)) out.matchWinner = rw;
        } else out.turn = (1 - side) as 0 | 1;

        if (out.matchWinner !== null) {
          this.status = 'ending'; this.pendingWinner = out.matchWinner; this.pendingForfeit = false; this.endAt = now + animMs + 1800;
        } else if (rw !== null) {
          this.status = 'roundEnd'; this.nextRoundAt = now + animMs + 2600; this.firstShooter = (1 - rw) as 0 | 1;
        } else {
          this.turn = (1 - side) as 0 | 1; this.busyUntil = now + animMs - 150; this.turnDeadline = now + animMs + TURN_MS;
        }
        const final = snapshot(this.world);
        this.broadcast({ t: 'flick', side, f, final, out, animMs, timeMs: TURN_MS }, { t: 'flick', side, f, final, out, animMs, timeMs: TURN_MS });
        await this.schedule();
        return;
      }
    }
  }

  // ---------------------------------------------------------------- game flow
  private startMatch() {
    const [a, b] = this.slots as Slot[];
    this.matchId = crypto.randomUUID();
    this.score = [0, 0]; this.heavy = [0, 0]; this.round = 1;
    this.world = buildWorld(getTable(this.tableId), [buildPenSpec(a.loadout), buildPenSpec(b.loadout)]);
    this.firstShooter = 0; this.lastEnd = null;
    this.slots.forEach((s) => { if (s) { s.rematch = false; s.afk = 0; } });
    this.beginRound();
  }

  private beginRound() {
    if (!this.world) return;
    resetRound(this.world);
    const now = Date.now();
    this.status = 'playing'; this.turn = this.firstShooter;
    this.busyUntil = now + 1500; this.turnDeadline = now + 1500 + TURN_MS;
    const m = this.roundMsg();
    this.broadcast(m, m);
  }

  private roundMsg(): ServerMsg {
    return { t: 'round', round: this.round, turn: this.turn, score: [...this.score], snap: snapshot(this.world!), timeMs: Math.max(0, this.turnDeadline - Date.now()), heavy: [...this.heavy] };
  }

  private sendSync(side: 0 | 1) {
    if (!this.world) return;
    this.send(side, this.roundMsg());
  }

  private async turnTimeout() {
    const s = this.slots[this.turn]!;
    s.afk++;
    if (s.afk >= 3) { await this.endMatch((1 - this.turn) as 0 | 1, true); return; }
    this.turn = (1 - this.turn) as 0 | 1;
    this.busyUntil = 0; this.turnDeadline = Date.now() + TURN_MS;
    const m: ServerMsg = { t: 'turn', turn: this.turn, timeMs: TURN_MS, skipped: true };
    this.broadcast(m, m);
  }

  private async endMatch(winner: 0 | 1, forfeit: boolean) {
    if (this.status === 'over') return;
    this.status = 'over';
    let rewards: (number | null)[] = [null, null];
    const [a, b] = this.slots;
    if (a && b) {
      const body = JSON.stringify({ matchId: this.matchId, code: this.code, p1: a.uid, p2: b.uid, winner, score: this.score, heavy: this.heavy, forfeit });
      try {
        const sig = await hmacHex(body, this.env.GAME_SECRET);
        const r = await fetch(this.env.API_URL.replace(/\/+$/, '') + '/api/match/report', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': sig }, body, signal: AbortSignal.timeout(8000),
        });
        if (r.ok) { const j = (await r.json()) as { rewards?: number[] }; if (j.rewards) rewards = j.rewards; }
        else console.log('match report failed', r.status, await r.text());
      } catch (e) { console.log('match report error', String(e)); }
    }
    const end: ServerMsg = { t: 'matchEnd', winner, score: [...this.score], heavy: [...this.heavy], rewards, forfeit };
    this.lastEnd = end;
    this.slots.forEach((s) => { if (s) s.rematch = false; });
    this.broadcast(end, end);
    this.touch();
  }

  // ---------------------------------------------------------------- timers
  async alarm() {
    const now = Date.now();
    if (this.status === 'countdown' && now >= this.startAt) {
      if (this.slots[0]?.ws && this.slots[1]?.ws) this.startMatch(); else this.status = 'lobby';
    }
    if (this.status === 'playing' && now >= this.turnDeadline) await this.turnTimeout();
    if (this.status === 'roundEnd' && now >= this.nextRoundAt) { this.round++; this.beginRound(); }
    if (this.status === 'ending' && now >= this.endAt) await this.endMatch(this.pendingWinner, this.pendingForfeit);

    // Someone left and never came back -> they forfeit.
    for (const side of [0, 1] as const) {
      const s = this.slots[side];
      if (s && !s.ws && s.dcAt && now - s.dcAt >= GRACE_MS) {
        if (this.status === 'playing' || this.status === 'roundEnd' || this.status === 'ending') await this.endMatch((1 - side) as 0 | 1, true);
        else s.dcAt = null;
      }
    }

    if (this.idleDeadline && now >= this.idleDeadline) {
      const e: ServerMsg = { t: 'error', code: 'EXPIRED', msg: 'This room has expired.' };
      this.broadcast(e, e);
      this.slots.forEach((s) => { try { s?.ws?.close(4002, 'expired'); } catch {} });
      this.slots = [null, null]; this.created = false; this.status = 'lobby'; this.world = null; this.idleDeadline = 0;
      return;
    }
    await this.schedule();
  }

  private touch() {
    const now = Date.now();
    this.idleDeadline = this.status === 'lobby' || this.status === 'countdown' ? now + LOBBY_IDLE_MS : this.status === 'over' ? now + OVER_IDLE_MS : 0;
  }

  private async schedule() {
    const times: number[] = [];
    if (this.status === 'countdown') times.push(this.startAt);
    if (this.status === 'playing') times.push(this.turnDeadline);
    if (this.status === 'roundEnd') times.push(this.nextRoundAt);
    if (this.status === 'ending') times.push(this.endAt);
    for (const s of this.slots) if (s && !s.ws && s.dcAt) times.push(s.dcAt + GRACE_MS);
    if (this.idleDeadline) times.push(this.idleDeadline);
    if (times.length) await this.state.storage.setAlarm(Math.max(Date.now() + 50, Math.min(...times)));
  }

  // ---------------------------------------------------------------- helpers
  private pub(s: Slot | null): PlayerPub | null { return s ? { uid: '', name: s.name, avatar: s.avatar, loadout: s.loadout } : null; }

  private helloMsg(side: 0 | 1): ServerMsg {
    return { t: 'hello', code: this.code, you: side, tableId: this.tableId, bestOf: this.bestOf, players: [this.pub(this.slots[0]), this.pub(this.slots[1])], status: this.status };
  }

  private raw(ws: WebSocket, msg: ServerMsg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  private send(side: 0 | 1, msg: ServerMsg) { const ws = this.slots[side]?.ws; if (ws) this.raw(ws, msg); }
  /** Sends m0 to player 0 and m1 to player 1 (pass different objects when the message differs per side). */
  private broadcast(m0: ServerMsg, m1: ServerMsg) { this.send(0, m0); this.send(1, m1); }
}
