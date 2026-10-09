// Everything you can equip or buy. Shared by the website, the API and the room server,
// so prices and stats can never disagree between them.
import type { PenSpec } from './physics';

export type Category = 'cover' | 'weight' | 'tip' | 'skin' | 'table';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PenMods { mass: number; radius: number; restitution: number; grip: number; length: number; spin: number }

export interface PenVis {
  layers?: number;        // extra cover sleeves (cover items)
  tape?: boolean;         // tape wrap stripes
  ring?: boolean;         // iron ring wrap
  weightSize?: number;    // 0..1 size of the tail weight
  weightColor?: number;
  tipColor?: number;
  tipBulb?: boolean;      // rubber ball tip
}

export interface TableDef {
  style: 'wood' | 'plastic' | 'glass' | 'concrete' | 'marble';
  color: string;
  accent: string;
  legColor: string;
  width: number;   // x size in cm
  depth: number;   // y size in cm (the direction pens are flicked)
  friction: number; // sliding friction coefficient
}

export interface Item {
  id: string;
  category: Category;
  name: string;
  desc: string;
  price: number;
  rarity: Rarity;
  mods?: Partial<PenMods>;
  vis?: PenVis;
  colors?: { body: number; accent: number; cap: number };
  table?: TableDef;
}

export interface Loadout { cover: string; weight: string; tip: string; skin: string }

export const DEFAULT_LOADOUT: Loadout = { cover: 'cover-1', weight: 'weight-0', tip: 'tip-std', skin: 'skin-blue' };
export const DEFAULT_TABLE = 'table-classroom';

const I = (i: Item) => i;

export const ITEM_LIST: Item[] = [
  // ---------- Covers ----------
  I({ id: 'cover-1', category: 'cover', name: 'Single Cover', desc: 'The plain biro as it came from the shop. Light and quick.', price: 0, rarity: 'common', vis: { layers: 0 } }),
  I({ id: 'cover-2', category: 'cover', name: 'Double Cover', desc: 'A second casing slid over the barrel. Heavier and a little thicker.', price: 150, rarity: 'common', mods: { mass: 2, radius: 0.08, restitution: -0.03, grip: 0.05 }, vis: { layers: 1 } }),
  I({ id: 'cover-3', category: 'cover', name: 'Triple Cover', desc: 'Three casings deep. Built to shove other pens off desks.', price: 400, rarity: 'rare', mods: { mass: 4, radius: 0.16, restitution: -0.06, grip: 0.08 }, vis: { layers: 2 } }),
  I({ id: 'cover-tape', category: 'cover', name: 'Masking-Tape Wrap', desc: 'Wrapped in masking tape. Stops sooner and is easier to control.', price: 250, rarity: 'common', mods: { mass: 1.5, grip: 0.25 }, vis: { layers: 0, tape: true } }),
  I({ id: 'cover-iron', category: 'cover', name: 'Iron Ring Wrap', desc: 'Steel rings along the barrel. Heavy, dead-sounding hits.', price: 750, rarity: 'epic', mods: { mass: 6, radius: 0.14, restitution: -0.1, grip: 0.1 }, vis: { layers: 1, ring: true } }),

  // ---------- Tail weights ----------
  I({ id: 'weight-0', category: 'weight', name: 'No Weight', desc: 'Stock end cap.', price: 0, rarity: 'common', vis: { weightSize: 0 } }),
  I({ id: 'weight-feather', category: 'weight', name: 'Feather Cap', desc: 'Hollowed-out cap. Launches faster but loses every shoving match.', price: 100, rarity: 'common', mods: { mass: -1.5 }, vis: { weightSize: 0, weightColor: 0xe6e6e6 } }),
  I({ id: 'weight-coin', category: 'weight', name: '10 Kobo Coin Cap', desc: 'A coin wedged in the tail. Cheap and effective.', price: 120, rarity: 'common', mods: { mass: 2.5 }, vis: { weightSize: 0.45, weightColor: 0xc9a227 } }),
  I({ id: 'weight-lead', category: 'weight', name: 'Lead Cap', desc: 'A fishing sinker pressed into the cap. Hits like a lorry.', price: 350, rarity: 'rare', mods: { mass: 6 }, vis: { weightSize: 0.75, weightColor: 0x5a6068 } }),
  I({ id: 'weight-brass', category: 'weight', name: 'Brass Cap', desc: 'Machined brass counterweight. The heaviest, and slightly longer.', price: 650, rarity: 'epic', mods: { mass: 9, length: 0.6 }, vis: { weightSize: 1, weightColor: 0xd9a21b } }),

  // ---------- Tips ----------
  I({ id: 'tip-std', category: 'tip', name: 'Standard Tip', desc: 'The tip it came with.', price: 0, rarity: 'common', vis: { tipColor: 0xb8bcc2 } }),
  I({ id: 'tip-rubber', category: 'tip', name: 'Rubber Tip', desc: 'Rubber nib cover. Bouncy, sends pens flying further.', price: 180, rarity: 'common', mods: { restitution: 0.15 }, vis: { tipColor: 0x1b1b1b, tipBulb: true } }),
  I({ id: 'tip-steel', category: 'tip', name: 'Steel Tip', desc: 'Steel ferrule. Hard, dense, and slides a bit farther.', price: 300, rarity: 'rare', mods: { restitution: -0.05, mass: 1, grip: -0.05 }, vis: { tipColor: 0x9aa4b2 } }),
  I({ id: 'tip-grippy', category: 'tip', name: 'Spin Tip', desc: 'Ridged rubber grip that adds extra spin to your flicks.', price: 220, rarity: 'rare', mods: { spin: 0.6 }, vis: { tipColor: 0xe5484d } }),
  I({ id: 'tip-teflon', category: 'tip', name: 'Teflon Tip', desc: 'Slick polymer nib. Slides a long way and is hard to stop.', price: 450, rarity: 'epic', mods: { grip: -0.3 }, vis: { tipColor: 0xffffff } }),

  // ---------- Skins ----------
  I({ id: 'skin-blue', category: 'skin', name: 'Blue Biro', desc: 'The one in every school bag.', price: 0, rarity: 'common', colors: { body: 0xcfd9ea, accent: 0x1b3fa8, cap: 0x1b3fa8 } }),
  I({ id: 'skin-black', category: 'skin', name: 'Black Biro', desc: 'For the quiet one at the back.', price: 0, rarity: 'common', colors: { body: 0xc9c9c9, accent: 0x151515, cap: 0x151515 } }),
  I({ id: 'skin-red', category: 'skin', name: 'Red Marking Pen', desc: 'The teacher’s marking red.', price: 80, rarity: 'common', colors: { body: 0xe8c9c9, accent: 0xb3202a, cap: 0xb3202a } }),
  I({ id: 'skin-gwg', category: 'skin', name: 'Green-White-Green', desc: 'Show the flag.', price: 150, rarity: 'rare', colors: { body: 0xf2f2ee, accent: 0x0a7a4b, cap: 0x0a7a4b } }),
  I({ id: 'skin-smoke', category: 'skin', name: 'Smoke Grey', desc: 'Tinted barrel, black nib. Looks expensive.', price: 200, rarity: 'rare', colors: { body: 0x8a8f96, accent: 0x1a1a1a, cap: 0x2a2a2a } }),
  I({ id: 'skin-camo', category: 'skin', name: 'Army Cadet', desc: 'Olive barrel from the cadet store.', price: 220, rarity: 'rare', colors: { body: 0x7d8a5c, accent: 0x3d4a2a, cap: 0x2a3320 } }),
  I({ id: 'skin-gold', category: 'skin', name: 'Gold Executive', desc: 'The pen that signs the result sheets.', price: 900, rarity: 'legendary', colors: { body: 0xd9b45a, accent: 0x8a6508, cap: 0xe3c36e } }),

  // ---------- Tables (width = x, depth = y, in cm) ----------
  I({ id: 'table-classroom', category: 'table', name: 'Classroom Bench Desk', desc: 'Scratched wooden bench desk with a steel frame. Balanced and fair.', price: 0, rarity: 'common',
    table: { style: 'wood', color: '#a8794a', accent: '#5a3a1f', legColor: '#2b2e31', width: 70, depth: 100, friction: 0.3 } }),
  I({ id: 'table-mini', category: 'table', name: 'Mini Reading Desk', desc: 'Small single desk. Everything is close to the edge.', price: 250, rarity: 'common',
    table: { style: 'wood', color: '#c29a68', accent: '#6f4a26', legColor: '#34373a', width: 52, depth: 76, friction: 0.27 } }),
  I({ id: 'table-plastic', category: 'table', name: 'Canteen Table', desc: 'Plastic canteen table. Slippery, so pens travel.', price: 200, rarity: 'common',
    table: { style: 'plastic', color: '#d9dde0', accent: '#aab2b8', legColor: '#7d868c', width: 70, depth: 100, friction: 0.2 } }),
  I({ id: 'table-concrete', category: 'table', name: 'Concrete Bench', desc: 'The bench under the mango tree. Rough, grippy and long.', price: 300, rarity: 'rare',
    table: { style: 'concrete', color: '#8d8d88', accent: '#5f5f5b', legColor: '#74746f', width: 78, depth: 108, friction: 0.45 } }),
  I({ id: 'table-glass', category: 'table', name: 'Lab Glass Top', desc: 'Science-lab glass. Almost frictionless.', price: 500, rarity: 'epic',
    table: { style: 'glass', color: '#cfe4e2', accent: '#8fb5b0', legColor: '#2b2f33', width: 64, depth: 92, friction: 0.115 } }),
  I({ id: 'table-marble', category: 'table', name: 'Marble Slab', desc: 'Polished slab from the principal’s office. Smooth and unforgiving.', price: 900, rarity: 'legendary',
    table: { style: 'marble', color: '#e6e4de', accent: '#7c808a', legColor: '#a8873a', width: 66, depth: 96, friction: 0.16 } }),
];

export const ITEMS: Record<string, Item> = Object.fromEntries(ITEM_LIST.map((i) => [i.id, i]));
export const FREE_ITEM_IDS = ITEM_LIST.filter((i) => i.price === 0).map((i) => i.id);
export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'cover', label: 'Covers', emoji: '' },
  { id: 'weight', label: 'Weights', emoji: '' },
  { id: 'tip', label: 'Tips', emoji: '' },
  { id: 'skin', label: 'Skins', emoji: '' },
  { id: 'table', label: 'Tables', emoji: '' },
];

export const itemsByCategory = (c: Category) => ITEM_LIST.filter((i) => i.category === c);
export const getTable = (id: string): TableDef => (ITEMS[id]?.table ?? ITEMS[DEFAULT_TABLE].table!);

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Turns a loadout into the numbers the physics engine uses. */
export function buildPenSpec(l: Loadout): PenSpec {
  const mods = [l.cover, l.weight, l.tip].map((id) => ITEMS[id]?.mods ?? {});
  const sum = (k: keyof PenMods) => mods.reduce((a, m) => a + (m[k] ?? 0), 0);
  const mass = round2(clamp(10 + sum('mass'), 6, 30));
  return {
    length: round2(clamp(14 + sum('length'), 12, 17)),
    radius: round2(clamp(0.6 + sum('radius'), 0.5, 1.1)),
    mass,
    restitution: round2(clamp(0.45 + sum('restitution'), 0.25, 0.8)),
    grip: round2(clamp(1 + sum('grip'), 0.5, 1.6)),
    spin: round2(clamp(1 + sum('spin'), 0.5, 2)),
    // Heavier pens launch slower: the trade-off for hitting harder.
    maxSpeed: round2(clamp(330 * Math.pow(10 / mass, 0.25), 200, 420)),
  };
}

export function normalizeLoadout(l: Partial<Loadout> | null | undefined): Loadout {
  const out = { ...DEFAULT_LOADOUT };
  if (!l) return out;
  (['cover', 'weight', 'tip', 'skin'] as const).forEach((k) => {
    const id = l[k];
    if (id && ITEMS[id]?.category === k) out[k] = id;
  });
  return out;
}

/** Returns a loadout where every slot the player does not own falls back to the default. */
export function sanitizeLoadout(l: Partial<Loadout> | null | undefined, owned: Iterable<string>): Loadout {
  const have = new Set<string>([...owned, ...FREE_ITEM_IDS]);
  const n = normalizeLoadout(l);
  (['cover', 'weight', 'tip', 'skin'] as const).forEach((k) => { if (!have.has(n[k])) n[k] = DEFAULT_LOADOUT[k]; });
  return n;
}

export function sanitizeTable(id: string | undefined, owned: Iterable<string>): string {
  const have = new Set<string>([...owned, ...FREE_ITEM_IDS]);
  return id && ITEMS[id]?.category === 'table' && have.has(id) ? id : DEFAULT_TABLE;
}

export const RARITY_COLOR: Record<Rarity, string> = { common: '#9ca3af', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
