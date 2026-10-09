'use client';
import { useEffect, useState } from 'react';
import { remote } from '@/lib/api';
import type { Level } from '@/lib/ai';
import type { Rival } from '@/lib/ladder';
import { ProfileProvider, useProfile } from '@/lib/ProfileContext';
import { toast } from '@/lib/toast';
import { track } from '@/lib/analytics';
import Home, { type Nav } from './Home';
import Ladder from './Ladder';
import Landing from './Landing';
import Leaderboard from './Leaderboard';
import Lobby from './Lobby';
import MatchView, { type MatchCfg } from './MatchView';
import ProfileView from './ProfileView';
import Shop from './Shop';
import { Spinner, ToastHost } from './ui';

type Screen = { n: 'landing' } | { n: 'home' } | { n: Exclude<Nav, 'local'> } | { n: 'match'; cfg: MatchCfg; key: number };

function Router({ joinCode }: { joinCode?: string }) {
  const { profile, mode } = useProfile();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [quality, setQualityState] = useState<'high' | 'low'>('high');

  useEffect(() => {
    let seen = false, q: string | null = null;
    try { seen = localStorage.getItem('nbf_seen') === '1'; q = localStorage.getItem('nbf_quality'); } catch {}
    setQualityState(q === 'low' || q === 'high' ? q : (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high');
    setScreen(seen || joinCode ? { n: 'home' } : { n: 'landing' });
  }, [joinCode]);

  const setQuality = (q: 'high' | 'low') => { setQualityState(q); try { localStorage.setItem('nbf_quality', q); } catch {} };
  const markSeen = () => { try { localStorage.setItem('nbf_seen', '1'); } catch {} };
  const toMatch = (cfg: MatchCfg) => setScreen({ n: 'match', cfg, key: Date.now() });

  // Opening an invite link (/join/CODE): jump straight into the room once the profile is ready.
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    if (!joinCode || joined || !profile || mode === 'loading') return;
    setJoined(true);
    if (mode === 'offline') { toast('Friend rooms need the online backend.', 'bad'); return; }
    if (joinCode.length !== 6) { toast('That invite code looks wrong.', 'bad'); return; }
    remote.roomToken({ code: joinCode }).then((r) => { markSeen(); toMatch({ mode: 'online', code: r.code, wsUrl: r.wsUrl }); }).catch((e) => toast(e.message, 'bad'));
  }, [joinCode, joined, profile, mode]);

  if (!screen || !profile) return <div className="notebook flex min-h-[100dvh] items-center justify-center"><Spinner text="Loading Naija Biro Fight…" /></div>;

  const home = () => setScreen({ n: 'home' });
  switch (screen.n) {
    case 'landing': return <Landing onPlay={() => { markSeen(); home(); }} onInvite={() => { markSeen(); setScreen({ n: 'lobby' }); }} />;
    case 'shop': return <Shop onBack={home} />;
    case 'lobby': return <Lobby onBack={home} onRoom={(r) => { track('room_open'); toMatch({ mode: 'online', code: r.code, wsUrl: r.wsUrl }); }} />;
    case 'leaderboard': return <Leaderboard onBack={home} />;
    case 'profile': return <ProfileView onBack={home} />;
    case 'ladder': return <Ladder onBack={home} onFight={(index: number, rival: Rival) => toMatch({ mode: 'ai', level: rival.level, rival: { index, rival } })} />;
    case 'match': {
      const cfg = screen.cfg;
      const exit = () => { window.history.replaceState(null, '', '/'); if (cfg.mode === 'ai' && cfg.rival) setScreen({ n: 'ladder' }); else home(); };
      return <MatchView key={screen.key} cfg={cfg} quality={quality} onExit={exit} />;
    }
    default: return <Home go={(n) => (n === 'local' ? toMatch({ mode: 'local' }) : setScreen({ n } as Screen))} playAi={(level: Level) => toMatch({ mode: 'ai', level })} quality={quality} setQuality={setQuality} />;
  }
}

export default function GameApp({ joinCode }: { joinCode?: string }) {
  return (
    <ProfileProvider>
      <Router joinCode={joinCode} />
      <ToastHost />
    </ProfileProvider>
  );
}
