'use client';
import { useState } from 'react';
import { ITEMS } from '@/shared/catalog';
import { REWARDS } from '@/shared/constants';
import { useProfile } from '@/lib/ProfileContext';
import type { Level } from '@/lib/ai';
import { ladderProgress, LADDER } from '@/lib/ladder';
import { sfx } from '@/lib/sound';
import { toast } from '@/lib/toast';
import { Avatar, Coins, Modal, Spinner } from './ui';
import PenPreview from './PenPreview';

export type Nav = 'shop' | 'lobby' | 'leaderboard' | 'profile' | 'ladder' | 'local';

export default function Home({ go, playAi, quality, setQuality }: { go: (n: Nav) => void; playAi: (l: Level) => void; quality: 'high' | 'low'; setQuality: (q: 'high' | 'low') => void }) {
  const { profile, mode, claimDaily } = useProfile();
  const [aiOpen, setAiOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());
  if (!profile) return <Spinner text="Setting up the desk…" />;

  const daily = async () => {
    const r = await claimDaily();
    if (r) { sfx.coin(); toast(`+${r.reward} coins. Day ${r.streak} of your streak.`, 'good'); }
  };
  const cleared = typeof window !== 'undefined' ? ladderProgress() : 0;
  const parts = [profile.loadout.cover, profile.loadout.weight, profile.loadout.tip].map((id) => ITEMS[id].name).join(' · ');

  return (
    <main className="notebook mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <button onClick={() => go('profile')} className="flex flex-1 items-center gap-3 text-left">
          <Avatar id={profile.avatar} size={48} />
          <span>
            <span className="block font-display text-xl font-semibold uppercase leading-none tracking-wide">{profile.username ?? 'Guest'}</span>
            <span className="text-xs text-white/55">{profile.wins} wins · {profile.losses} losses{profile.guest ? ' · tap to save progress' : ''}</span>
          </span>
        </button>
        <Coins n={profile.coins} />
      </header>

      {mode === 'offline' && (
        <div className="rounded-md border border-waec/40 bg-waec/10 p-2.5 text-center text-xs font-medium text-waec">
          Offline mode: progress saves on this device only. Friend rooms and ranks need the backend (see README).
        </div>
      )}

      <section className="paper relative overflow-hidden !p-0">
        <PenPreview loadout={profile.loadout} tableId={profile.tableId} focus="pen" className="h-52 bg-gradient-to-b from-[#2a2723] to-[#14110e]" />
        <div className="p-3">
          <p className="font-display text-lg font-semibold uppercase tracking-wide">{ITEMS[profile.loadout.skin].name}</p>
          <p className="text-xs text-black/65">{parts}</p>
          <p className="text-xs text-black/65">Desk: {ITEMS[profile.tableId].name}</p>
        </div>
        <button className="btn btn-white btn-sm absolute right-3 top-3" onClick={() => go('shop')}>Fortify</button>
      </section>

      {profile.dailyAvailable && (
        <button className="btn btn-yellow animate-floaty w-full" onClick={daily}>Claim daily reward · {REWARDS.dailyBase}+ coins</button>
      )}

      <button className="btn btn-green w-full !py-4 text-2xl" onClick={() => go('lobby')}>Fight a friend online</button>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn btn-white" onClick={() => go('ladder')}>
          Break-Time Ladder<span className="ml-1 text-xs font-bold opacity-60">{Math.min(cleared, LADDER.length)}/{LADDER.length}</span>
        </button>
        <button className="btn btn-white" onClick={() => go('local')}>Pass the phone</button>
        <button className="btn btn-white" onClick={() => setAiOpen(true)}>Quick practice</button>
        <button className="btn btn-white" onClick={() => go('leaderboard')}>Ranks</button>
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-white/55">
        <button className="underline" onClick={() => setHelp(true)}>How to play</button>
        <button className="underline" onClick={() => { const m = !muted; sfx.setMuted(m); setMuted(m); }}>Sound: {muted ? 'off' : 'on'}</button>
        <button className="underline" onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}>Graphics: {quality === 'high' ? 'High' : 'Low'}</button>
      </footer>

      {aiOpen && (
        <Modal title="Quick practice" onClose={() => setAiOpen(false)}>
          <p className="mb-3 text-sm text-black/70">Choose an opponent. Practice coins are capped at {REWARDS.aiDailyCap} per day.</p>
          <div className="flex flex-col gap-2">
            {([['easy', 'Easy', 'btn-white'], ['normal', 'Tough', 'btn-yellow'], ['hard', 'Brutal', 'btn-red']] as const).map(([l, label, c]) => (
              <button key={l} className={`btn ${c}`} onClick={() => { setAiOpen(false); playAi(l); }}>{label}</button>
            ))}
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="How to play" onClose={() => setHelp(false)}>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li><b>Pull back</b> anywhere on the desk, then <b>release</b> to flick your pen. A longer pull is a harder flick.</li>
            <li>Take turns. <b>Knock the other pen off the desk</b> to win the round. If your own pen slides off, you lose it.</li>
            <li>First to win 2 rounds takes the match. Hard knocks count as <b>heavy hits</b> and pay bonus coins.</li>
            <li>Spin (↺ • ↻) curls the flick. In <b>Fortify</b>, heavier pens hit harder but launch slower, and every desk has different friction.</li>
            <li>Climb the <b>Break-Time Ladder</b>, hand your phone to a friend, or send an invite link and fight online.</li>
          </ol>
        </Modal>
      )}
    </main>
  );
}
