import { buildPenSpec, getTable, type Loadout } from '@/shared/catalog';
import { REWARDS, TURN_SECONDS } from '@/shared/constants';
import { applyFlick, buildWorld, isAtRest, judgeTurn, loadSnapshot, resetRound, roundsToWin, sanitizeFlick, stepWorld, type Flick, type Snap } from '@/shared/game';
import { FIXED_DT, type World } from '@/shared/physics';
import type { Outcome, PlayerPub, ServerMsg } from '@/shared/protocol';
import type { BiroScene, CamMode, Quality } from '@/game3d/BiroScene';
import { chooseFlick, type Level } from './ai';
import { RoomConnection, type ConnState } from './online';
import { sfx } from './sound';

export type Phase = 'loading' | 'waiting' | 'banner' | 'aim' | 'moving' | 'over';

export interface MatchUI {
  phase: Phase;
  turn: 0 | 1;
  mySide: 0 | 1;
  players: [PlayerPub | null, PlayerPub | null];
  score: [number, number];
  heavy: [number, number];
  bestOf: number;
  round: number;
  banner: string | null;
  bannerSub: string | null;
  power: number;
  timeLeft: number | null;
  conn: 'ok' | 'reconnecting' | 'closed';
  oppConnected: boolean;
  roomCode: string | null;
  error: string | null;
  emote: { side: 0 | 1; id: number; n: number } | null;
  result: null | { winner: 0 | 1; forfeit: boolean; coins: number | null };
  rematchAsked: boolean;
  oppRematch: boolean;
}

export interface MatchSetup {
  mode: 'ai' | 'online' | 'local';
  level?: Level;
  opponent?: PlayerPub;   // set for Break-Time Ladder rivals
  tableId: string;
  me: PlayerPub;
  wsUrl?: string;
  roomCode?: string;
  quality: Quality;
  onFinished?: (r: { won: boolean; heavy: number }) => void;
}

const MAX_PULL_PX = 150;
const HEAVY_BANNERS = ['HEAVY HIT', 'CLEAN KNOCK', 'WHACK'];
const AI_NAMES = ['Oga Teacher', 'Class Prefect', 'Area Boy', 'Senior Boy', 'Jambite'];

export class MatchEngine {
  ui: MatchUI;
  private scene!: BiroScene;
  private world!: World;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private alive = true;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private conn: RoomConnection | null = null;
  private turnEndsAt = 0;
  private tickIv: ReturnType<typeof setInterval> | null = null;
  private drag: { sx: number; sy: number; tx: number; ty: number } | null = null;
  private spin = 0;
  private firstShooter: 0 | 1 = 0;
  private pending: { side: 0 | 1; out: Outcome; final: Snap; timeMs: number } | null = null;
  private localHeavy: [number, number] = [0, 0];
  private tableId: string;
  private emoteN = 0;
  private lastTickSec = -1;

  constructor(private canvas: HTMLCanvasElement, private setup: MatchSetup, private emit: (u: MatchUI) => void) {
    this.tableId = setup.tableId;
    const meSide: 0 | 1 = 0;
    this.ui = {
      phase: 'loading', turn: 0, mySide: meSide, players: [setup.me, null], score: [0, 0], heavy: [0, 0], bestOf: 3, round: 1,
      banner: null, bannerSub: null, power: 0, timeLeft: null, conn: 'ok', oppConnected: true, roomCode: setup.roomCode ?? null,
      error: null, emote: null, result: null, rematchAsked: false, oppRematch: false,
    };
  }

  private set(p: Partial<MatchUI>) { this.ui = { ...this.ui, ...p }; this.emit(this.ui); }
  private later(ms: number, fn: () => void) { this.timers.push(setTimeout(() => { if (this.alive) fn(); }, ms)); }
  /** Whose pen the local human controls right now (in pass-the-phone mode that is whoever's turn it is). */
  private get mine(): 0 | 1 { return this.setup.mode === 'local' ? this.ui.turn : this.ui.mySide; }

  // ---------------------------------------------------------------- lifecycle
  async start() {
    const { BiroScene } = await import('@/game3d/BiroScene');
    if (!this.alive) return;
    this.scene = new BiroScene(this.canvas, this.setup.quality, this.tableId, { onFall: () => sfx.fall() });
    const specs = (l: Loadout) => buildPenSpec(l);
    const me = this.setup.me;

    if (this.setup.mode !== 'online') {
      const aiLoadout: Loadout = { cover: Math.random() < 0.4 ? 'cover-2' : 'cover-1', weight: Math.random() < 0.3 ? 'weight-coin' : 'weight-0', tip: 'tip-std', skin: ['skin-black', 'skin-red', 'skin-camo'][Math.floor(Math.random() * 3)] };
      const opp: PlayerPub = this.setup.opponent ?? (this.setup.mode === 'local'
        ? { uid: 'p2', name: 'Player 2', avatar: (me.avatar + 5) % 12, loadout: me.loadout }
        : { uid: 'ai', name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)], avatar: Math.floor(Math.random() * 12), loadout: aiLoadout });
      this.world = buildWorld(getTable(this.tableId), [specs(me.loadout), specs(opp.loadout)], true);
      this.scene.setPens([me.loadout, opp.loadout]);
      this.scene.setMySide(0);
      this.set({ players: [me, opp], phase: 'banner' });
      this.startAiRound(true);
    } else {
      // Placeholder world until the server tells us who is in the room.
      this.world = buildWorld(getTable(this.tableId), [specs(me.loadout), specs(me.loadout)], true);
      this.scene.setPens([me.loadout, me.loadout]);
      this.set({ phase: 'waiting' });
      this.conn = new RoomConnection(this.setup.wsUrl!, (m) => this.onServer(m), (s: ConnState) => this.onConn(s));
      this.conn.connect();
    }

    this.attachInput();
    this.tickIv = setInterval(() => this.tickTimer(), 250);
    if (this.setup.mode === 'local') this.set({ players: [{ ...me, name: me.name === 'You' ? 'Player 1' : me.name }, this.ui.players[1]] });
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.alive) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    if (this.tickIv) clearInterval(this.tickIv);
    this.conn?.close();
    sfx.slideStop();
    this.detachInput();
    this.scene?.dispose();
  }

  // ---------------------------------------------------------------- public controls
  setSpin(v: number) { this.spin = v; }
  setCameraMode(m: CamMode) { this.scene?.setCameraMode(m); }
  sendEmote(id: number) { this.conn?.send({ t: 'emote', id }); }
  rematch() {
    if (this.setup.mode !== 'online') { this.restartAi(); return; }
    this.conn?.send({ t: 'rematch' }); this.set({ rematchAsked: true });
  }

  // ---------------------------------------------------------------- frame loop
  private frame(dt: number) {
    if (!this.scene) return;
    if (this.ui.phase === 'moving') {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= FIXED_DT && guard++ < 12) { stepWorld(this.world); this.acc -= FIXED_DT; }
      for (const e of this.world.events) {
        this.scene.hit(e); sfx.hit(e.speed);
        if (e.speed >= 85) { sfx.heavy(); try { navigator.vibrate?.(30); } catch {} }
      }
      this.world.events.length = 0;
      let vmax = 0;
      for (const p of this.world.pens) if (!p.fallen) vmax = Math.max(vmax, Math.sqrt(p.vx * p.vx + p.vy * p.vy));
      sfx.slide(Math.min(1, vmax / 220));
      if (isAtRest(this.world)) this.settled();
    }
    this.scene.update(this.world, dt);
  }

  private settled() {
    this.acc = 0;
    sfx.slideStop();
    if (this.setup.mode !== 'online') this.settleAi(); else this.settleOnline();
  }

  // ---------------------------------------------------------------- shared helpers
  private flickNow(side: 0 | 1, f: Flick) {
    applyFlick(this.world, side, f);
    this.world.events.length = 0;
    this.acc = 0;
    sfx.flick(f.power);
    this.scene.setAim(null);
    this.scene.setTurn(null, true);
    this.set({ phase: 'moving', power: 0 });
  }

  private showBanner(text: string, sub: string | null, ms: number, then?: () => void) {
    this.set({ banner: text, bannerSub: sub });
    this.later(ms, () => { this.set({ banner: null, bannerSub: null }); then?.(); });
  }

  private beginAim(turn: 0 | 1, timeMs: number | null) {
    this.scene.setTurn(turn, this.setup.mode === 'local' || turn === this.ui.mySide);
    this.turnEndsAt = timeMs !== null ? performance.now() + timeMs : 0;
    this.lastTickSec = -1;
    this.set({ phase: 'aim', turn, timeLeft: timeMs !== null ? Math.ceil(timeMs / 1000) : null });
  }

  private tickTimer() {
    if (this.ui.phase !== 'aim' || !this.turnEndsAt) return;
    const s = Math.max(0, Math.ceil((this.turnEndsAt - performance.now()) / 1000));
    if (s !== this.ui.timeLeft) {
      this.set({ timeLeft: s });
      if (s <= 5 && s > 0 && this.ui.turn === this.mine && s !== this.lastTickSec) { sfx.tick(); this.lastTickSec = s; }
    }
  }

  // ---------------------------------------------------------------- AI mode
  private aiScore: [number, number] = [0, 0];

  private startAiRound(first: boolean) {
    resetRound(this.world);
    this.scene.setAim(null);
    const round = this.aiScore[0] + this.aiScore[1] + 1;
    this.set({ round, phase: 'banner', score: [...this.aiScore] as [number, number] });
    this.showBanner(`ROUND ${round}`, first ? 'Pull back and release to flick' : null, 1300, () => this.aiTurn(this.firstShooter));
  }

  private aiTurn(side: 0 | 1) {
    this.beginAim(side, null);
    if (side === 1 && this.setup.mode === 'ai') {
      this.later(900 + Math.random() * 600, () => {
        if (this.ui.phase !== 'aim') return;
        this.flickNow(1, chooseFlick(this.world, 1, this.setup.level ?? 'normal'));
      });
    }
  }

  private settleAi() {
    const shooter = this.ui.turn;
    this.localHeavy[shooter] += this.world.heavy;
    if (this.world.heavy > 0) this.heavyBanner();
    this.set({ heavy: [...this.localHeavy] as [number, number] });
    const rw = judgeTurn(this.world, shooter);
    if (rw === null) { this.aiTurn((1 - shooter) as 0 | 1); return; }
    this.aiScore[rw]++;
    this.set({ score: [...this.aiScore] as [number, number], phase: 'banner' });
    const need = roundsToWin(3);
    const local = this.setup.mode === 'local';
    const won = local ? true : rw === 0;
    won ? sfx.roundWin() : sfx.roundLose();
    const who = local ? `PLAYER ${rw + 1}` : won ? 'YOU' : this.ui.players[1]?.name?.toUpperCase() ?? 'OPPONENT';
    const fellOwn = this.world.pens[shooter].fallen;
    if (this.aiScore[rw] >= need) {
      this.showBanner(local ? `${who} WINS` : won ? 'YOU WIN' : 'YOU LOSE', null, 1600, () => this.finishAi(rw));
    } else {
      this.firstShooter = (1 - rw) as 0 | 1;
      this.showBanner(local ? `${who} TAKES THE ROUND` : won ? 'ROUND WON' : 'ROUND LOST', fellOwn ? 'Pen slid off its own desk' : 'Pen knocked off the desk', 1900, () => this.startAiRound(false));
    }
  }

  private finishAi(winner: 0 | 1) {
    const local = this.setup.mode === 'local';
    const won = winner === 0;
    won || local ? sfx.win() : sfx.lose();
    this.set({ phase: 'over', result: { winner, forfeit: false, coins: null } });
    if (!local) this.setup.onFinished?.({ won, heavy: this.localHeavy[0] });
  }

  setAiCoins(c: number) { this.set({ result: this.ui.result ? { ...this.ui.result, coins: c } : null }); }

  private restartAi() {
    this.aiScore = [0, 0]; this.localHeavy = [0, 0]; this.firstShooter = 0;
    this.set({ result: null, heavy: [0, 0], score: [0, 0] });
    this.startAiRound(true);
  }

  private heavyBanner() {
    const b = HEAVY_BANNERS[Math.floor(Math.random() * HEAVY_BANNERS.length)];
    this.set({ bannerSub: b });
    this.later(900, () => { if (this.ui.bannerSub === b) this.set({ bannerSub: null }); });
  }

  // ---------------------------------------------------------------- online mode
  private onConn(s: ConnState) {
    this.set({ conn: s === 'open' ? 'ok' : s });
    if (s === 'closed' && this.ui.phase !== 'over' && !this.ui.error) this.set({ error: 'Connection lost. Check your network and try again.' });
  }

  private onServer(m: ServerMsg) {
    switch (m.t) {
      case 'hello': {
        const players = m.players as [PlayerPub | null, PlayerPub | null];
        this.set({ mySide: m.you, players, roomCode: m.code, bestOf: m.bestOf });
        this.scene.setMySide(m.you);
        if (m.tableId !== this.tableId) { this.tableId = m.tableId; this.scene.setTable(m.tableId); }
        const a = players[0]?.loadout ?? this.setup.me.loadout, b = players[1]?.loadout ?? a;
        this.world = buildWorld(getTable(this.tableId), [buildPenSpec(a), buildPenSpec(b)], true);
        this.scene.setPens([a, b]);
        if (this.ui.phase === 'loading' || this.ui.phase === 'waiting') this.set({ phase: 'waiting' });
        break;
      }
      case 'round': {
        this.pending = null;
        loadSnapshot(this.world, m.snap);
        this.world.events.length = 0;
        this.set({ score: m.score, heavy: m.heavy, round: m.round, phase: 'banner', result: null });
        const go = () => this.beginAim(m.turn, Math.max(0, m.timeMs - 1200));
        this.showBanner(`ROUND ${m.round}`, m.turn === this.mine ? 'You flick first' : 'Opponent flicks first', 1200, go);
        break;
      }
      case 'flick': {
        this.pending = { side: m.side, out: m.out, final: m.final, timeMs: m.timeMs };
        this.flickNow(m.side, m.f);
        this.set({ turn: m.side });
        break;
      }
      case 'turn':
        this.beginAim(m.turn, m.timeMs);
        if (m.skipped) this.set({ bannerSub: 'Turn skipped (too slow)' });
        break;
      case 'opp': this.set({ oppConnected: m.connected }); break;
      case 'emote': this.set({ emote: { side: m.side, id: m.id, n: ++this.emoteN } }); break;
      case 'rematch': this.set({ oppRematch: true }); break;
      case 'matchEnd': {
        this.flushPending();
        const won = m.winner === this.mine;
        won ? sfx.win() : sfx.lose();
        this.set({ phase: 'over', banner: null, score: m.score, heavy: m.heavy, rematchAsked: false, oppRematch: false,
          result: { winner: m.winner, forfeit: !!m.forfeit, coins: m.rewards[this.mine] ?? null } });
        if (m.rewards[this.mine]) sfx.coin();
        break;
      }
      case 'error': this.set({ error: m.msg }); break;
    }
  }

  private flushPending() {
    if (!this.pending) return;
    loadSnapshot(this.world, this.pending.final);
    this.pending = null;
  }

  private settleOnline() {
    const p = this.pending;
    if (!p) { this.set({ phase: 'aim' }); return; }
    this.pending = null;
    loadSnapshot(this.world, p.final); // snap to the server's authoritative result
    const out = p.out;
    this.set({ heavy: out.heavy, score: out.score });
    if (this.world.heavy > 0) this.heavyBanner();
    if (out.roundWinner !== null) {
      const won = out.roundWinner === this.mine;
      won ? sfx.roundWin() : sfx.roundLose();
      if (out.matchWinner === null) this.showBanner(won ? 'ROUND WON' : 'ROUND LOST', won ? 'Pen knocked off the desk' : 'Your pen left the desk', 2300);
      this.set({ phase: 'banner' });
    } else if (out.turn !== null) {
      this.beginAim(out.turn, p.timeMs);
    }
  }

  // ---------------------------------------------------------------- input
  private onDown = (e: PointerEvent) => {
    if (this.ui.phase !== 'aim' || this.ui.turn !== this.mine || this.ui.banner) return;
    const t = this.scene.screenToTable(e.clientX, e.clientY);
    if (!t) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { sx: e.clientX, sy: e.clientY, tx: t.x, ty: t.y };
  };

  private onMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const t = this.scene.screenToTable(e.clientX, e.clientY);
    if (!t) return;
    const aim = this.aimFrom(e.clientX, e.clientY, t);
    if (!aim) { this.scene.setAim(null); this.set({ power: 0 }); return; }
    this.scene.setAim({ owner: this.mine, ...aim });
    this.set({ power: aim.power });
  };

  private onUp = (e: PointerEvent) => {
    if (!this.drag) return;
    const t = this.scene.screenToTable(e.clientX, e.clientY);
    const aim = t ? this.aimFrom(e.clientX, e.clientY, t) : null;
    this.drag = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch {}
    this.scene.setAim(null);
    this.set({ power: 0 });
    if (!aim) return;
    const f = sanitizeFlick({ dx: aim.dx, dy: aim.dy, power: aim.power, spin: this.spin });
    if (!f) return;
    if (this.setup.mode !== 'online') this.flickNow(this.mine, f);
    else { this.conn?.send({ t: 'flick', f }); this.set({ phase: 'moving' }); this.scene.setTurn(null, true); }
  };

  private aimFrom(cx: number, cy: number, t: { x: number; y: number }) {
    const d = this.drag!;
    const px = Math.sqrt((cx - d.sx) ** 2 + (cy - d.sy) ** 2);
    const power = Math.min(1, px / MAX_PULL_PX);
    if (power < 0.06) return null;
    const vx = d.tx - t.x, vy = d.ty - t.y; // pulling back = flicking the other way
    const l = Math.sqrt(vx * vx + vy * vy);
    if (l < 1e-6) return null;
    return { dx: vx / l, dy: vy / l, power };
  }

  private onCancel = () => { this.drag = null; this.scene?.setAim(null); this.set({ power: 0 }); };

  private attachInput() {
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onCancel);
  }
  private detachInput() {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
  }
}

export { REWARDS, TURN_SECONDS };
