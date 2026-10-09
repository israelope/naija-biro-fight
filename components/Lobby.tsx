'use client';
import { useState } from 'react';
import { remote } from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { toast } from '@/lib/toast';
import { BackBar } from './ui';

export default function Lobby({ onBack, onRoom }: { onBack: () => void; onRoom: (r: { code: string; wsUrl: string }) => void }) {
  const { mode } = useProfile();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const enter = async (b: { create?: boolean; code?: string }) => {
    setBusy(true);
    try { onRoom(await remote.roomToken(b)); }
    catch (e: any) { toast(e?.message || 'Could not open a room.', 'bad'); }
    setBusy(false);
  };

  return (
    <main className="notebook mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 py-5">
      <BackBar title="Fight a friend" onBack={onBack} />
      {mode === 'offline' ? (
        <div className="paper font-semibold">
          Friend rooms need the online backend (Neon + Cloudflare room server). Follow the README to switch it on. You can still practise against the AI.
        </div>
      ) : (
        <>
          <section className="paper space-y-3">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">Create a room</h2>
            <p className="text-sm text-black/70">You get a link and a 6-character code to send on WhatsApp. Your friend joins instantly, no signup needed.</p>
            <button className="btn btn-green w-full" disabled={busy} onClick={() => enter({ create: true })}>Create room &amp; invite</button>
          </section>
          <section className="paper space-y-3">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">Have a code?</h2>
            <input className="input text-center font-display text-3xl uppercase tracking-[0.3em]" maxLength={6} placeholder="ABC123" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            <button className="btn btn-yellow w-full" disabled={busy || code.length !== 6} onClick={() => enter({ code })}>Join room</button>
          </section>
        </>
      )}
    </main>
  );
}
