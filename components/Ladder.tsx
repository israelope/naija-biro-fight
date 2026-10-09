'use client';
import { useEffect, useState } from 'react';
import { LADDER, ladderProgress, type Rival } from '@/lib/ladder';
import { ITEMS } from '@/shared/catalog';
import { Avatar, BackBar } from './ui';

const LEVEL_LABEL = { easy: 'Easy', normal: 'Tough', hard: 'Brutal' } as const;

export default function Ladder({ onBack, onFight }: { onBack: () => void; onFight: (index: number, r: Rival) => void }) {
  const [cleared, setCleared] = useState(0);
  useEffect(() => setCleared(ladderProgress()), []);
  const champion = cleared >= LADDER.length;

  return (
    <main className="notebook mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 px-4 py-5">
      <BackBar title="Break-Time Ladder" onBack={onBack} />
      <p className="text-sm leading-relaxed text-white/70">
        {champion ? 'You are the undisputed pen-fight champion of the school. Replay any rival below.' : 'Nine classmates stand between you and the Head Boy. Beat them in order, from JSS 1 all the way up. Each fights on their own desk with their own pen.'}
      </p>
      <ol className="space-y-2.5">
        {LADDER.map((r, i) => {
          const done = i < cleared, open = i <= cleared, current = i === cleared && !champion;
          return (
            <li key={r.name} className={`paper flex items-center gap-3 !p-3 ${!open ? 'opacity-55' : ''} ${current ? 'ring-2 ring-waec' : ''}`}>
              <div className="relative"><Avatar id={r.avatar} size={46} />{done && <span className="absolute -bottom-1 -right-1 rounded-full border border-black/50 bg-naija px-1 text-[10px] font-bold text-white">✓</span>}</div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-display text-lg font-semibold uppercase tracking-wide">{r.nickname} <span className="text-sm font-medium normal-case text-black/50">· {r.name}, {r.form}</span></p>
                <p className="text-xs text-black/65">{r.blurb}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-black/45">{LEVEL_LABEL[r.level]} · {ITEMS[r.tableId].name}</p>
              </div>
              {open ? <button className="btn btn-green btn-sm" onClick={() => onFight(i, r)}>{done ? 'Again' : 'Fight'}</button> : <span className="text-xs font-bold uppercase tracking-wider text-black/40">Locked</span>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
