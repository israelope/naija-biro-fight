'use client';
import { useEffect, useRef, useState } from 'react';
import { remote } from '@/lib/api';
import type { Level } from '@/lib/ai';
import { markCleared, type Rival } from '@/lib/ladder';
import { MatchEngine, type MatchUI } from '@/lib/matchEngine';
import { useProfile } from '@/lib/ProfileContext';
import { sfx } from '@/lib/sound';
import { toast } from '@/lib/toast';
import { track } from '@/lib/analytics';
import { Avatar, Coin, Modal, shareInvite, shareLink } from './ui';

export type MatchCfg =
  | { mode: 'ai'; level: Level; rival?: { index: number; rival: Rival } }
  | { mode: 'local' }
  | { mode: 'online'; code: string; wsUrl: string };

const PHRASES = ['Ehn!', 'Wahala', 'Oya!', 'Chai', 'Nice one', 'Abeg', 'Rematch?', 'Na wa'];

function Pips({ score, need, mine }: { score: number; need: number; mine: boolean }) {
  return (
    <span className="flex gap-1">
      {Array.from({ length: need }).map((_, i) => (
        <span key={i} className={`h-2.5 w-5 rounded-sm border border-black/50 ${i < score ? (mine ? 'bg-waec' : 'bg-margin') : 'bg-white/15'}`} />
      ))}
    </span>
  );
}

export default function MatchView({ cfg, quality, onExit }: { cfg: MatchCfg; quality: 'high' | 'low'; onExit: () => void }) {
  const { profile, aiResult } = useProfile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const aiResultRef = useRef(aiResult);
  aiResultRef.current = aiResult;
  const [ui, setUi] = useState<MatchUI | null>(null);
  const [spin, setSpin] = useState(0);
  const [cam, setCam] = useState<'3d' | 'top'>('3d');
  const [showPhrases, setShowPhrases] = useState(false);
  const [bubble, setBubble] = useState<{ side: 0 | 1; id: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [webglFail, setWebglFail] = useState(false);

  useEffect(() => {
    if (!profile || !canvasRef.current) return;
    const me = { uid: profile.id, name: profile.username ?? (cfg.mode === 'local' ? 'Player 1' : 'You'), avatar: profile.avatar, loadout: profile.loadout };
    const rival = cfg.mode === 'ai' ? cfg.rival : undefined;
    const engine = new MatchEngine(canvasRef.current, {
      mode: cfg.mode, level: cfg.mode === 'ai' ? cfg.level : undefined, quality, me,
      tableId: rival ? rival.rival.tableId : profile.tableId,
      opponent: rival ? { uid: 'ai', name: rival.rival.nickname, avatar: rival.rival.avatar, loadout: rival.rival.loadout } : undefined,
      wsUrl: cfg.mode === 'online' ? cfg.wsUrl : undefined, roomCode: cfg.mode === 'online' ? cfg.code : undefined,
      onFinished: ({ won, heavy }) => {
        if (won && rival) markCleared(rival.index);
        aiResultRef.current(won, heavy).then((c) => { engine.setAiCoins(c); if (c) sfx.coin(); });
      },
    }, setUi);
    engineRef.current = engine;
    engine.start().catch((e) => { console.error(e); setWebglFail(true); });
    track('match_start', { mode: cfg.mode });
    return () => { engine.dispose(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ui?.emote) return;
    setBubble({ side: ui.emote.side, id: ui.emote.id });
    const t = setTimeout(() => setBubble(null), 2400);
    return () => clearTimeout(t);
  }, [ui?.emote?.n]);

  if (webglFail) return (
    <div className="notebook flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-display text-2xl font-semibold uppercase">3D is not supported here</p>
      <p className="max-w-sm text-sm text-white/70">Try Chrome or Safari, switch off battery saver, or set Graphics to Low on the home screen.</p>
      <button className="btn btn-yellow" onClick={onExit}>Back</button>
    </div>
  );

  const local = cfg.mode === 'local';
  const need = 2;
  const me = local ? 0 : (ui?.mySide ?? 0);
  const opp = (1 - me) as 0 | 1;
  const players = ui?.players;
  const theirs = players?.[opp];
  const myTurn = ui?.phase === 'aim' && (local || ui.turn === me);
  const waiting = cfg.mode === 'online' && (ui?.phase === 'waiting' || ui?.phase === 'loading');
  const joined = !!(players?.[0] && players?.[1]);
  const rival = cfg.mode === 'ai' ? cfg.rival : undefined;
  const winnerIsMe = ui?.result ? (local ? true : ui.result.winner === me) : false;
  const turnLabel = !ui ? '' : ui.phase === 'moving' ? '' : local ? `${players?.[ui.turn]?.name ?? 'Player'}: your flick` : myTurn ? 'Your flick' : cfg.mode === 'ai' ? `${theirs?.name ?? 'Opponent'} is lining up` : "Opponent's turn";

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#15130f]">
      <canvas ref={canvasRef} className="game" />
      <div className="vignette" />

      {/* top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {[opp, me].map((side, k) => {
          const p = players?.[side];
          const isTurn = ui?.turn === side && (ui?.phase === 'aim' || ui?.phase === 'moving');
          return (
            <div key={k} className={`glass relative flex flex-1 items-center gap-2 p-1.5 ${k === 1 ? 'flex-row-reverse text-right' : ''} ${isTurn ? '!border-waec/70' : ''}`}>
              <Avatar id={p?.avatar ?? 0} size={34} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-display text-base font-semibold uppercase tracking-wide">{p ? p.name : 'Waiting…'}</p>
                <div className={k === 1 ? 'flex justify-end' : ''}><Pips score={ui?.score[side] ?? 0} need={need} mine={side === me} /></div>
              </div>
              {bubble?.side === side && <span className="animate-pop absolute -bottom-9 whitespace-nowrap rounded-md border border-black/40 bg-naija-chalk px-2 py-1 text-sm font-bold text-naija-ink">{PHRASES[bubble.id]}</span>}
            </div>
          );
        })}
      </div>

      {ui && (ui.phase === 'aim' || ui.phase === 'moving') && turnLabel && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(4.1rem+env(safe-area-inset-top))] flex justify-center">
          <span className="glass px-3 py-1 font-display text-sm font-semibold uppercase tracking-[0.14em]">
            {turnLabel}{ui.timeLeft !== null && ui.phase === 'aim' ? <span className={ui.timeLeft <= 5 ? 'ml-2 text-margin' : 'ml-2 text-waec'}>{ui.timeLeft}s</span> : null}
          </span>
        </div>
      )}

      {ui?.banner && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <p className="animate-pop font-display text-5xl font-bold uppercase tracking-[0.12em] text-[#f4efe0] drop-shadow-[0_3px_14px_rgba(0,0,0,.85)] sm:text-7xl">{ui.banner}</p>
          {ui.bannerSub && <p className="glass mt-3 px-3 py-1 text-sm font-medium tracking-wide">{ui.bannerSub}</p>}
        </div>
      )}
      {!ui?.banner && ui?.bannerSub && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center"><p className="animate-pop font-display text-4xl font-bold uppercase tracking-[0.14em] text-[#f4efe0] drop-shadow-[0_3px_12px_rgba(0,0,0,.9)]">{ui.bannerSub}</p></div>
      )}

      {/* bottom controls */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {myTurn && (
          <div className="mx-auto w-full max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gradient-to-r from-[#d9c27a] to-[#c9553d]" style={{ width: `${(ui?.power ?? 0) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-center text-xs font-medium uppercase tracking-[0.16em] text-white/70">Pull back, release to flick</p>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-2">
          <button className="glass px-3 py-2 font-display text-sm font-semibold uppercase tracking-wider" onClick={() => setMenu(true)}>Menu</button>
          <div className="glass flex items-center gap-0.5 p-1">
            <span className="px-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">Spin</span>
            {([[-1, '↺'], [0, '•'], [1, '↻']] as const).map(([v, l]) => (
              <button key={v} className={`h-8 w-9 rounded font-display text-lg ${spin === v ? 'bg-waec text-black' : 'text-white/80'}`} aria-label={`Spin ${v}`} onClick={() => { setSpin(v); engineRef.current?.setSpin(v); }}>{l}</button>
            ))}
          </div>
          <button className="glass px-3 py-2 font-display text-sm font-semibold uppercase tracking-wider" onClick={() => { const m = cam === '3d' ? 'top' : '3d'; setCam(m); engineRef.current?.setCameraMode(m); }}>{cam === '3d' ? 'Top view' : '3D view'}</button>
          {cfg.mode === 'online' && <button className="glass px-3 py-2 font-display text-sm font-semibold uppercase tracking-wider" onClick={() => setShowPhrases((s) => !s)}>Chat</button>}
        </div>
        {showPhrases && (
          <div className="glass mx-auto flex max-w-sm flex-wrap justify-center gap-1 p-1.5">
            {PHRASES.map((e, i) => <button key={i} className="rounded border border-white/15 px-2 py-1 text-sm font-semibold" onClick={() => { engineRef.current?.sendEmote(i); setShowPhrases(false); }}>{e}</button>)}
          </div>
        )}
      </div>

      {ui?.conn === 'reconnecting' && <div className="glass absolute inset-x-0 top-28 mx-auto w-max px-3 py-1 text-sm font-semibold text-waec">Reconnecting…</div>}
      {ui && cfg.mode === 'online' && !ui.oppConnected && ui.phase !== 'over' && !waiting && (
        <div className="glass absolute inset-x-0 top-28 mx-auto w-max px-3 py-1 text-sm font-semibold text-waec">Opponent disconnected. Holding the seat for 30s…</div>
      )}

      {waiting && !ui?.error && (
        <Modal title={joined ? 'Opponent has arrived' : 'Waiting for your friend'}>
          {joined ? <p className="font-medium">Match starts in a moment…</p> : (
            <>
              <p className="text-sm text-black/70">Send the link on WhatsApp, or give your friend this code. The room closes after 15 minutes.</p>
              <p className="my-3 rounded-md border border-dashed border-black/50 bg-white/60 py-3 text-center font-display text-5xl font-bold tracking-[0.3em]">{ui?.roomCode ?? (cfg.mode === 'online' ? cfg.code : '')}</p>
              <div className="flex flex-col gap-2">
                <button className="btn btn-green" onClick={() => shareInvite(ui?.roomCode ?? (cfg as any).code)}>Share invite</button>
                <button className="btn btn-white" onClick={() => { navigator.clipboard?.writeText(shareLink(ui?.roomCode ?? (cfg as any).code)); toast('Link copied', 'good'); }}>Copy link</button>
              </div>
            </>
          )}
          <button className="mt-3 w-full text-center text-sm font-semibold underline" onClick={onExit}>Cancel</button>
        </Modal>
      )}

      {ui?.error && (
        <Modal title="Problem">
          <p className="font-medium">{ui.error}</p>
          <button className="btn btn-yellow mt-3 w-full" onClick={onExit}>Back to home</button>
        </Modal>
      )}

      {ui?.phase === 'over' && ui.result && (
        <Modal title={local ? `Player ${ui.result.winner + 1} wins` : winnerIsMe ? (rival ? `${rival.rival.nickname} beaten` : 'Match won') : 'Match lost'}>
          <p className="font-display text-5xl font-bold">{ui.score[me]} <span className="text-black/40">–</span> {ui.score[opp]}</p>
          {rival && winnerIsMe && <p className="mt-1 text-sm font-medium text-black/70">Next rival unlocked on the Ladder.</p>}
          {ui.result.forfeit && <p className="mt-1 text-sm font-medium">{ui.result.winner === me ? 'Your opponent left the match.' : 'You were away for too long.'}</p>}
          {!local && <p className="mt-1 text-sm font-semibold text-black/70">Heavy hits: {ui.heavy[me]}</p>}
          {!local && <p className="mt-2 flex items-center gap-1.5 text-lg font-bold">
            {ui.result.coins === null ? (cfg.mode === 'ai' ? 'Counting coins…' : '') : ui.result.coins > 0 ? <>+{ui.result.coins} <Coin /></> : 'Daily coin limit reached'}
          </p>}
          <div className="mt-3 flex flex-col gap-2">
            <button className="btn btn-green" disabled={ui.rematchAsked} onClick={() => engineRef.current?.rematch()}>
              {ui.oppRematch ? 'Accept rematch' : ui.rematchAsked ? 'Waiting for opponent…' : 'Rematch'}
            </button>
            {cfg.mode === 'online' && winnerIsMe && (
              <a className="btn btn-white" target="_blank" rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`I just beat ${theirs?.name ?? 'my friend'} ${ui.score[me]}-${ui.score[opp]} on Naija Biro Fight. Think you can beat me? ${typeof window !== 'undefined' ? window.location.origin : ''}`)}`}>Share the win on WhatsApp</a>
            )}
            <button className="btn btn-yellow" onClick={onExit}>{rival ? 'Back to the Ladder' : 'Home'}</button>
            {cfg.mode === 'online' && <button className="text-sm font-semibold underline" onClick={() => setMenu(true)}>Report opponent</button>}
          </div>
        </Modal>
      )}

      {menu && (
        <Modal title="Menu" onClose={() => setMenu(false)}>
          <div className="flex flex-col gap-2">
            <button className="btn btn-white" onClick={() => { const m = !muted; sfx.setMuted(m); setMuted(m); }}>{muted ? 'Sound: off' : 'Sound: on'}</button>
            {cfg.mode === 'online' && theirs && (
              <>
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-black/60">Report {theirs.name}</p>
                {[['abusive', 'Abusive or toxic'], ['cheating', 'Cheating'], ['inappropriate-name', 'Inappropriate username']].map(([r, l]) => (
                  <button key={r} className="btn btn-red btn-sm" onClick={() => remote.report(theirs.name, r).then(() => { toast('Report sent. Thank you.', 'good'); setMenu(false); }).catch((e) => toast(e.message, 'bad'))}>{l}</button>
                ))}
              </>
            )}
            <button className="btn btn-yellow mt-2" onClick={onExit}>Leave match</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
