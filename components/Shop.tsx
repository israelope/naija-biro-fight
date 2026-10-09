'use client';
import { useMemo, useState } from 'react';
import { CATEGORIES, ITEMS, RARITY_COLOR, buildPenSpec, itemsByCategory, type Category, type Loadout } from '@/shared/catalog';
import { useProfile } from '@/lib/ProfileContext';
import { sfx } from '@/lib/sound';
import { toast } from '@/lib/toast';
import { BackBar, Coin, Coins, Spinner } from './ui';
import PenPreview from './PenPreview';

function Stat({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-extrabold">
      <span className="w-14 text-black/60">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/15"><span className="block h-full bg-naija" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></span>
    </div>
  );
}

export default function Shop({ onBack }: { onBack: () => void }) {
  const { profile, buy, saveLoadout } = useProfile();
  const [cat, setCat] = useState<Category>('cover');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // What the preview shows: equipped gear with the selected item swapped in.
  const preview = useMemo(() => {
    if (!profile) return null;
    const loadout: Loadout = { ...profile.loadout };
    let tableId = profile.tableId;
    if (sel) {
      const it = ITEMS[sel];
      if (it.category === 'table') tableId = sel; else loadout[it.category as keyof Loadout] = sel;
    }
    return { loadout, tableId };
  }, [profile, sel]);

  if (!profile || !preview) return <Spinner />;
  const owned = new Set(profile.owned);
  const equipped = new Set<string>([...Object.values(profile.loadout), profile.tableId]);
  const item = sel ? ITEMS[sel] : null;
  const spec = buildPenSpec(preview.loadout);

  const equip = async () => {
    if (!item) return;
    setBusy(true);
    await saveLoadout(preview.loadout, preview.tableId);
    sfx.click(); toast(`${item.name} equipped`, 'good');
    setBusy(false);
  };
  const purchase = async () => {
    if (!item) return;
    setBusy(true);
    const ok = await buy(item.id);
    if (ok) { sfx.coin(); toast(`Bought ${item.name}!`, 'good'); }
    setBusy(false);
  };

  return (
    <main className="notebook mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 px-4 py-5">
      <BackBar title="Fortify" onBack={onBack} right={<Coins n={profile.coins} />} />

      <section className="paper !p-0 overflow-hidden">
        <PenPreview loadout={preview.loadout} tableId={preview.tableId} focus={cat === 'table' ? 'table' : 'pen'} className="h-56 bg-gradient-to-b from-[#2a2723] to-[#14110e]" />
        <div className="space-y-1 p-3">
          <p className="font-display text-xl font-semibold uppercase leading-none tracking-wide">{item ? item.name : 'Tap an item to preview it'}</p>
          {item && <p className="text-sm font-semibold text-black/70">{item.desc}</p>}
          {cat !== 'table' && cat !== 'skin' && (
            <div className="pt-1">
              <Stat label="Weight" value={spec.mass} max={30} />
              <Stat label="Speed" value={spec.maxSpeed} max={420} />
              <Stat label="Bounce" value={spec.restitution} max={0.8} />
              <Stat label="Slide" value={2 - spec.grip} max={1.5} />
            </div>
          )}
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => { setCat(c.id); setSel(null); }} className={`btn btn-sm shrink-0 ${cat === c.id ? 'btn-yellow' : 'btn-white'}`}>{c.label}</button>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 pb-24">
        {itemsByCategory(cat).map((it) => {
          const isOwned = owned.has(it.id) || it.price === 0;
          return (
            <button key={it.id} onClick={() => { sfx.click(); setSel(it.id); }}
              className={`paper relative text-left !p-3 transition ${sel === it.id ? 'ring-2 ring-waec' : ''}`}>
              <span className="mb-1 block h-1.5 w-10 rounded-full" style={{ background: RARITY_COLOR[it.rarity] }} />
              <span className="block font-display text-base font-semibold uppercase leading-tight tracking-wide">{it.name}</span>
              <span className="mt-1 block text-sm font-extrabold">
                {equipped.has(it.id) ? <span className="text-naija">Equipped</span> : isOwned ? <span className="text-black/60">Owned</span> : <span className="inline-flex items-center gap-1"><Coin /> {it.price}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {item && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 p-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="flex-1 font-display text-lg font-semibold uppercase leading-none tracking-wide">{item.name}</div>
            {equipped.has(item.id) ? <span className="tag">Equipped</span>
              : owned.has(item.id) || item.price === 0 ? <button className="btn btn-green" disabled={busy} onClick={equip}>Equip</button>
              : <button className="btn btn-yellow" disabled={busy || profile.coins < item.price} onClick={purchase}>{profile.coins < item.price ? `Need ${item.price} coins` : `Buy · ${item.price}`}</button>}
          </div>
        </div>
      )}
    </main>
  );
}
