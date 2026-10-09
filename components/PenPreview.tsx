'use client';
import { useEffect, useRef } from 'react';
import type { Loadout } from '@/shared/catalog';
import type { PreviewScene, PreviewFocus } from '@/game3d/PreviewScene';

export default function PenPreview({ loadout, tableId, focus, hero, className = '' }: { loadout: Loadout; tableId: string; focus: PreviewFocus; hero?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PreviewScene | null>(null);
  const latest = useRef({ loadout, tableId, focus });
  latest.current = { loadout, tableId, focus };

  useEffect(() => {
    let dead = false;
    import('@/game3d/PreviewScene').then(({ PreviewScene }) => {
      if (dead || !ref.current) return;
      try { sceneRef.current = new PreviewScene(ref.current, { hero }); sceneRef.current.set(latest.current); } catch { /* no WebGL */ }
    });
    return () => { dead = true; sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { sceneRef.current?.set({ loadout, tableId, focus }); }, [loadout, tableId, focus]);

  return <div className={`relative overflow-hidden ${className}`}><canvas ref={ref} className="absolute inset-0 h-full w-full" /></div>;
}
