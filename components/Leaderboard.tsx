'use client';
import { useEffect, useState } from 'react';
import { NG_STATES } from '@/shared/constants';
import { remote } from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { Avatar, BackBar, Spinner } from './ui';

type Row = { username: string; avatar: number; state: string | null; school: string | null; wins: number };

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const { mode } = useProfile();
  const [scope, setScope] = useState<'week' | 'all'>('week');
  const [state, setState] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (mode !== 'online') return;
    setRows(null); setErr('');
    remote.leaderboard(scope, state || undefined).then((r) => { setRows(r.rows); setMe(r.me); }).catch((e) => setErr(e.message));
  }, [scope, state, mode]);

  return (
    <main className="notebook mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 px-4 py-5">
      <BackBar title="Ranks" onBack={onBack} />
      {mode !== 'online' ? <div className="paper font-semibold">Leaderboards need the online backend. See the README.</div> : (
        <>
          <div className="flex gap-2">
            <button className={`btn btn-sm flex-1 ${scope === 'week' ? 'btn-yellow' : 'btn-white'}`} onClick={() => setScope('week')}>This week</button>
            <button className={`btn btn-sm flex-1 ${scope === 'all' ? 'btn-yellow' : 'btn-white'}`} onClick={() => setScope('all')}>All time</button>
          </div>
          <select className="input" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All of Nigeria</option>
            {NG_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {err && <p className="paper font-bold">{err}</p>}
          {!rows && !err && <Spinner />}
          {rows && rows.length === 0 && <p className="paper font-semibold">No wins recorded yet. Be the first on the board!</p>}
          <ol className="space-y-2">
            {rows?.map((r, i) => (
              <li key={r.username} className={`paper flex items-center gap-3 !p-2.5 ${r.username === me ? 'ring-2 ring-waec' : ''}`}>
                <span className={`w-8 text-center font-display text-2xl font-bold ${i < 3 ? 'text-waec' : 'text-black/50'}`}>{i + 1}</span>
                <Avatar id={r.avatar} size={38} />
                <span className="flex-1 leading-tight"><b>{r.username}</b><br /><span className="text-xs font-semibold text-black/60">{[r.school, r.state].filter(Boolean).join(' · ') || 'Naija'}</span></span>
                <span className="tag">{r.wins} W</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
