'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { AVATARS, AVATAR_BG } from '@/shared/constants';

export function Avatar({ id, size = 44, ring }: { id: number; size?: number; ring?: string }) {
  const i = ((id % 12) + 12) % 12;
  return (
    <span className="inline-flex shrink-0 select-none items-center justify-center rounded-full border border-black/50 font-display font-bold text-white/90 shadow-[inset_0_2px_3px_rgba(255,255,255,.25),inset_0_-3px_5px_rgba(0,0,0,.3)]"
      style={{ width: size, height: size, background: AVATAR_BG[i], fontSize: size * 0.5, boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }}>
      {AVATARS[i]}
    </span>
  );
}

export const Coin = () => <span className="coin" />;

export function Coins({ n }: { n: number }) {
  return <span className="tag !bg-black/50 !text-[#ece7d8] border-white/15"><span className="coin" /> {n.toLocaleString()}</span>;
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div className="paper animate-pop max-h-[90vh] w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="mb-2 font-display text-2xl font-semibold uppercase tracking-wide">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; message: string; kind: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail; const id = ++n;
      setItems((a) => [...a.slice(-2), { id, ...d }]);
      setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener('nbf-toast', h);
    return () => window.removeEventListener('nbf-toast', h);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {items.map((t) => (
        <div key={t.id} className={`animate-pop rounded-md border border-black/40 px-4 py-2 text-sm font-semibold shadow-[0_6px_18px_rgba(0,0,0,.5)] ${t.kind === 'bad' ? 'bg-[#e8c4be] text-[#4a1612]' : t.kind === 'good' ? 'bg-[#cfe3d3] text-[#12331f]' : 'bg-naija-chalk text-naija-ink'}`}>{t.message}</div>
      ))}
    </div>
  );
}

export function Spinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-waec" />
      {text && <p className="text-sm font-medium tracking-wide text-white/70">{text}</p>}
    </div>
  );
}

export function BackBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <button className="btn btn-white btn-sm" onClick={onBack} aria-label="Back">←</button>
      <h1 className="flex-1 font-display text-3xl font-bold uppercase leading-none tracking-wide">{title}</h1>
      {right}
    </div>
  );
}

export const shareLink = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`;

export async function shareInvite(code: string) {
  const url = shareLink(code);
  const text = `Come and fight me on Naija Biro Fight. Room code: ${code}`;
  try { if (navigator.share) { await navigator.share({ title: 'Naija Biro Fight', text, url }); return; } } catch { return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
}
