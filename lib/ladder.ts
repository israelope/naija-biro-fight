// "Break-Time Ladder": our own single-player campaign. Beat every classmate up the school to the Head Boy.
import type { Loadout } from '@/shared/catalog';
import type { Level } from './ai';

export interface Rival {
  name: string; nickname: string; form: string; blurb: string; level: Level; avatar: number;
  loadout: Loadout; tableId: string;
}

const L = (cover: string, weight: string, tip: string, skin: string): Loadout => ({ cover, weight, tip, skin });

export const LADDER: Rival[] = [
  { name: 'Tunde', nickname: 'Small Boy', form: 'JSS 1', blurb: 'Just resumed. Flicks with his eyes closed.', level: 'easy', avatar: 0, loadout: L('cover-1', 'weight-0', 'tip-std', 'skin-blue'), tableId: 'table-classroom' },
  { name: 'Amaka', nickname: 'Front Row', form: 'JSS 1', blurb: 'Neat handwriting, neater aim.', level: 'easy', avatar: 8, loadout: L('cover-1', 'weight-feather', 'tip-std', 'skin-gwg'), tableId: 'table-classroom' },
  { name: 'Emeka', nickname: 'Calculus', form: 'JSS 3', blurb: 'Calculates every angle. Overthinks the power.', level: 'normal', avatar: 1, loadout: L('cover-2', 'weight-0', 'tip-std', 'skin-black'), tableId: 'table-mini' },
  { name: 'Bisi', nickname: 'Canteen Queen', form: 'JSS 3', blurb: 'Home ground: the slippery canteen table.', level: 'normal', avatar: 3, loadout: L('cover-1', 'weight-coin', 'tip-teflon', 'skin-red'), tableId: 'table-plastic' },
  { name: 'Yusuf', nickname: 'Back Bench', form: 'SS 1', blurb: 'Hasn’t lost since the long vacation.', level: 'normal', avatar: 5, loadout: L('cover-2', 'weight-coin', 'tip-rubber', 'skin-black'), tableId: 'table-classroom' },
  { name: 'Chidi', nickname: 'Mango Tree', form: 'SS 2', blurb: 'Fights on the concrete bench. Heavy pen, heavier hands.', level: 'hard', avatar: 6, loadout: L('cover-3', 'weight-lead', 'tip-std', 'skin-camo'), tableId: 'table-concrete' },
  { name: 'Folake', nickname: 'Lab Rat', form: 'SS 2', blurb: 'Plays on lab glass. You will not be able to stop your pen.', level: 'hard', avatar: 10, loadout: L('cover-tape', 'weight-0', 'tip-teflon', 'skin-smoke'), tableId: 'table-glass' },
  { name: 'Musa', nickname: 'Senior Prefect', form: 'SS 3', blurb: 'Confiscates pens. Beats people with them.', level: 'hard', avatar: 7, loadout: L('cover-iron', 'weight-brass', 'tip-steel', 'skin-black'), tableId: 'table-classroom' },
  { name: 'Ayo', nickname: 'Head Boy', form: 'SS 3', blurb: 'Unbeaten. Signs the result sheets with a gold pen.', level: 'hard', avatar: 3, loadout: L('cover-3', 'weight-brass', 'tip-rubber', 'skin-gold'), tableId: 'table-marble' },
];

const KEY = 'nbf_ladder_v1';
export function ladderProgress(): number {
  try { return Math.min(LADDER.length, Math.max(0, parseInt(localStorage.getItem(KEY) || '0', 10) || 0)); } catch { return 0; }
}
export function markCleared(index: number) {
  try { if (index + 1 > ladderProgress()) localStorage.setItem(KEY, String(index + 1)); } catch {}
}
