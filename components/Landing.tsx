'use client';
import Link from 'next/link';
import { DEFAULT_LOADOUT } from '@/shared/catalog';
import PenPreview from './PenPreview';

export default function Landing({ onPlay, onInvite }: { onPlay: () => void; onInvite: () => void }) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0d1411]">
      {/* live 3D hero: two real biros on a worn desk */}
      <PenPreview loadout={DEFAULT_LOADOUT} tableId="table-classroom" focus="table" hero className="absolute inset-0 opacity-95" />
      <div className="vignette" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1411]/80 via-transparent to-[#0d1411]" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-between px-6 pb-8 pt-10">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.4em] text-waec">Break-time · Last bench</p>
          <h1 className="mt-3 font-display text-[4.2rem] font-bold uppercase leading-[0.88] tracking-tight text-[#f1ecdc] sm:text-7xl">
            Naija<br />Biro<br />Fight
          </h1>
        </div>

        <div>
          <p className="mb-5 max-w-xs text-[15px] leading-relaxed text-white/75">
            Two biros on a scratched desk while the teacher faces the board. Flick yours into theirs. Whoever&apos;s pen leaves the desk loses the round.
          </p>
          <div className="flex flex-col gap-3">
            <button className="btn btn-yellow w-full !py-3.5 text-xl" onClick={onPlay}>Play now</button>
            <button className="btn btn-white w-full" onClick={onInvite}>Fight a friend</button>
          </div>
          <p className="mt-4 text-xs text-white/45">
            Free · No signup needed · <Link className="underline" href="/terms">Terms</Link> · <Link className="underline" href="/privacy">Privacy</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
