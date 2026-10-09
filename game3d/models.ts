import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ITEMS, type Loadout, type TableDef } from '@/shared/catalog';
import type { PenSpec } from '@/shared/physics';
import { chalkboardTexture, deskSurface, floorTexture, penLabel, wallTexture, windowTexture } from './textures';

export const FLOOR_Y = -72;
export const KEY_POS = new THREE.Vector3(-130, 150, 50);

/** Image-based lighting from a procedural room: gives plastic, steel and glass believable reflections. */
export function applyEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.5): THREE.Texture {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  (scene as any).environmentIntensity = intensity;
  pm.dispose();
  return env;
}

const seedOf = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const steel = (color: string | number, rough = 0.38) => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: rough });

/** Table with its top surface at y = 0. */
export function buildTable(def: TableDef): THREE.Group {
  const g = new THREE.Group();
  const thick = def.style === 'concrete' ? 6 : def.style === 'marble' ? 4 : def.style === 'glass' ? 1.6 : 3.2;
  const s = deskSurface(def.style, def.color, def.accent, seedOf(def.style + def.width));

  let topMat: THREE.Material;
  switch (def.style) {
    case 'wood': topMat = new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 1.2, roughness: 0.6, envMapIntensity: 0.6 }); break;
    case 'plastic': topMat = new THREE.MeshPhysicalMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 0.5, roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.4 }); break;
    case 'concrete': topMat = new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 3, roughness: 0.95, envMapIntensity: 0.3 }); break;
    case 'marble': topMat = new THREE.MeshPhysicalMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 0.3, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1 }); break;
    default: topMat = new THREE.MeshPhysicalMaterial({ color: def.color, transparent: true, opacity: 0.42, roughness: 0.6, roughnessMap: s.map, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
  }
  const top = new THREE.Mesh(new RoundedBoxGeometry(def.width, thick, def.depth, 3, Math.min(0.45, thick / 2 - 0.05)), topMat);
  top.position.y = -thick / 2; top.receiveShadow = true; top.castShadow = def.style !== 'glass';
  g.add(top);

  const legH = -FLOOR_Y - thick;
  const hw = def.width / 2, hd = def.depth / 2;
  const add = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  if (def.style === 'concrete') {
    const slab = new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 3, roughness: 1 });
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(10, legH, def.depth - 24), slab)).position.set(sx * (hw - 14), -thick - legH / 2, 0);
  } else {
    const mat = def.style === 'marble' ? steel(def.legColor, 0.25) : def.style === 'glass' ? steel('#c9ced2', 0.15) : steel(def.legColor, 0.45);
    const r = def.style === 'glass' ? 1.1 : 1.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, legH, 14), mat)).position.set(sx * (hw - 6), -thick - legH / 2, sz * (hd - 6));
    // rails (long sides and cross bars)
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, def.depth - 16), mat)).position.set(sx * (hw - 6), -thick - 5, 0);
    for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(def.width - 14, 1.8, 1.8), mat)).position.set(0, -thick - 5, sz * (hd - 6));
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, def.depth - 16), mat)).position.set(sx * (hw - 6), FLOOR_Y + 14, 0);
    if (def.style === 'wood' || def.style === 'plastic') { // under-desk book rack
      const rack = new THREE.MeshStandardMaterial({ color: '#4b3b2c', roughness: 0.85 });
      add(new THREE.Mesh(new THREE.BoxGeometry(def.width - 14, 1.2, def.depth * 0.5), rack)).position.set(0, -thick - 17, 0);
      const book = new THREE.MeshStandardMaterial({ color: '#7a2f2f', roughness: 0.8 });
      add(new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 28), book)).position.set(-8, -thick - 18.7, 4);
    }
  }
  return g;
}

/** A biro lying along its local +X axis (nib at +X, cap at -X), centred on the origin. */
export function buildPen(spec: PenSpec, loadout: Loadout): THREE.Group {
  const g = new THREE.Group();
  const L = spec.length, r = spec.radius;
  const skin = ITEMS[loadout.skin]?.colors ?? { body: 0xcfd9ea, accent: 0x1b3fa8, cap: 0x1b3fa8 };
  const cover = ITEMS[loadout.cover]?.vis ?? {};
  const weight = ITEMS[loadout.weight]?.vis ?? {};
  const tip = ITEMS[loadout.tip]?.vis ?? {};
  const cap = new THREE.Color(skin.cap), acc = new THREE.Color(skin.accent);

  const add = (m: THREE.Mesh) => { m.castShadow = true; g.add(m); return m; };
  const alongX = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number) => { const m = new THREE.Mesh(geo, mat); m.rotation.z = Math.PI / 2; m.position.x = x; return add(m); };
  const plastic = (c: THREE.ColorRepresentation, rough = 0.32) => new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const glassy = (opacity: number, map?: THREE.Texture) => new THREE.MeshPhysicalMaterial({ color: skin.body, map, transparent: true, opacity, roughness: 0.16, clearcoat: 0.8, clearcoatRoughness: 0.12, depthWrite: false });

  const capLen = L * 0.16, noseLen = L * 0.17;
  const bStart = -L / 2 + capLen, bEnd = L / 2 - noseLen, bLen = bEnd - bStart, bMid = (bStart + bEnd) / 2;

  // translucent hexagonal barrel with printed text, ink cartridge visible inside
  const label = penLabel('STAR WRITER  0.7 FINE  ·  MADE IN NAIJA', '#' + cap.getHexString());
  const barrel = alongX(new THREE.CylinderGeometry(r, r, bLen, 6), glassy(0.6, label), bMid); barrel.renderOrder = 2; barrel.castShadow = false;
  const inkMat = new THREE.MeshStandardMaterial({ color: acc, roughness: 0.4 });
  alongX(new THREE.CylinderGeometry(r * 0.26, r * 0.26, bLen * 0.94, 10), inkMat, bMid);
  alongX(new THREE.CylinderGeometry(r * 0.16, r * 0.16, bLen * 0.5, 8), new THREE.MeshStandardMaterial({ color: acc.clone().multiplyScalar(0.55), roughness: 0.5 }), bMid - bLen * 0.2);

  // nose cone + metal point (or rubber / steel / ridged versions)
  const noseX = bEnd + noseLen / 2;
  alongX(new THREE.CylinderGeometry(r * 0.2, r * 0.98, noseLen, 6), plastic(cap), noseX);
  const tipC = tip.tipColor ?? 0xb8bcc2;
  if (tip.tipBulb) {
    const rub = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 20, 14), new THREE.MeshStandardMaterial({ color: tipC, roughness: 0.92 }));
    rub.scale.set(1.15, 1, 1); rub.position.x = L / 2 - r * 0.7; add(rub);
  } else {
    alongX(new THREE.CylinderGeometry(r * 0.13, r * 0.2, r * 1.3, 12), steel(tipC, 0.28), L / 2 - r * 0.1);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), steel(0xdadde2, 0.15)); ball.position.x = L / 2 + r * 0.55; add(ball);
    if (loadout.tip === 'tip-steel') alongX(new THREE.CylinderGeometry(r * 0.42, r * 0.5, r * 1.1, 12), steel(0x9aa4b2, 0.3), L / 2 - r * 1.5);
    if (loadout.tip === 'tip-grippy') for (let i = 0; i < 4; i++) alongX(new THREE.CylinderGeometry(r * 0.62, r * 0.62, r * 0.28, 8), new THREE.MeshStandardMaterial({ color: 0xa4252b, roughness: 0.9 }), L / 2 - r * (1.2 + i * 0.5));
  }

  // tail cap, vent hole, pocket clip
  alongX(new THREE.CylinderGeometry(r * 1.04, r * 1.04, capLen, 6), plastic(cap), -L / 2 + capLen / 2);
  alongX(new THREE.CylinderGeometry(r * 0.2, r * 0.2, r * 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }), -L / 2 - 0.02);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(capLen * 1.9, r * 0.14, r * 0.55), steel(0xd0d4d9, 0.2));
  clip.position.set(-L / 2 + capLen * 1.05, r * 1.12, 0); add(clip);
  const clipEnd = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 8, 6), steel(0xd0d4d9, 0.2)); clipEnd.position.set(-L / 2 + capLen * 2.0, r * 1.02, 0); add(clipEnd);

  // fortifications
  for (let i = 0; i < (cover.layers ?? 0); i++) {
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(r * (1.12 + i * 0.1), r * (1.12 + i * 0.1), bLen * (0.92 - i * 0.14), 6), glassy(0.5 + i * 0.05, label));
    sl.rotation.z = Math.PI / 2; sl.position.x = bMid; sl.renderOrder = 3 + i; g.add(sl);
  }
  if (cover.tape) {
    const tape = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.95 });
    const tape2 = new THREE.MeshStandardMaterial({ color: 0xcdbd90, roughness: 0.95 });
    for (let i = 0; i < 5; i++) alongX(new THREE.CylinderGeometry(r * 1.2, r * 1.2, bLen / 5.4, 6), i % 2 ? tape : tape2, bStart + (i + 0.55) * (bLen / 5));
  }
  if (cover.ring) for (let i = 0; i < 3; i++) alongX(new THREE.CylinderGeometry(r * 1.3, r * 1.3, bLen * 0.07, 14), steel(0x8b9199, 0.3), bStart + bLen * (0.22 + i * 0.26));
  const ws = weight.weightSize ?? 0;
  if (ws > 0) {
    const len = r * (1.6 + ws * 2.6);
    const wm = steel(weight.weightColor ?? 0x888888, loadout.weight === 'weight-brass' ? 0.28 : 0.55);
    alongX(new THREE.CylinderGeometry(r * (1.1 + ws * 0.3), r * (1.1 + ws * 0.3), len, 18), wm, -L / 2 + len / 2 - 0.1);
    if (loadout.weight === 'weight-coin') alongX(new THREE.CylinderGeometry(r * 1.5, r * 1.5, r * 0.16, 28), steel(0xc9a227, 0.35), -L / 2 - r * 0.15);
  }
  g.userData.rest = r;
  return g;
}

function neighbourDesk(mat: THREE.Material, steelMat: THREE.Material): THREE.Group {
  const d = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(70, 3.2, 100, 2, 0.4), mat); top.position.y = -1.6; top.receiveShadow = top.castShadow = true; d.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, -FLOOR_Y - 3.2, 10), steelMat); l.position.set(sx * 29, FLOOR_Y / 2 - 1.6, sz * 44); l.castShadow = true; d.add(l); }
  const palette = ['#2f5d8a', '#8a2f2f', '#2f7a4a', '#c9a227', '#4a4a4a'];
  for (let i = 0; i < 2; i++) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2 + i * 0.5, 24), new THREE.MeshStandardMaterial({ color: palette[Math.floor(Math.random() * palette.length)], roughness: 0.8 }));
    book.position.set((Math.random() - 0.5) * 30, 0.7 + i * 1.1, (Math.random() - 0.5) * 60); book.rotation.y = (Math.random() - 0.5) * 0.8; book.castShadow = true; d.add(book);
    const lab = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 6), new THREE.MeshStandardMaterial({ color: '#efe9d6', roughness: 0.9 })); lab.position.copy(book.position); lab.position.y += 0.75 + i * 0.25; lab.rotation.y = book.rotation.y; d.add(lab);
  }
  return d;
}

/** Invisible slats that cast striped window light across the desk (only used on high quality). */
export function buildLouvres(): THREE.Group {
  const dir = KEY_POS.clone().negate().normalize();
  const g = new THREE.Group();
  g.position.copy(KEY_POS).addScaledVector(dir, 75);
  g.lookAt(g.position.clone().add(dir));
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (let i = -3; i <= 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(200, 6, 0.8), mat);
    b.position.y = i * 26; b.rotation.x = 0.55; b.castShadow = true; g.add(b);
  }
  return g;
}

export function buildRoom(): THREE.Group {
  const g = new THREE.Group();
  const f = floorTexture();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: f.map, bumpMap: f.bump, bumpScale: 2, roughness: 0.82, envMapIntensity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#cfc9b6', roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 175; g.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.95, envMapIntensity: 0.2 });
  const wallGeo = new THREE.PlaneGeometry(700, 250);
  const wy = FLOOR_Y + 125;
  const walls: [number, number, number, number][] = [[0, wy, -300, 0], [0, wy, 300, Math.PI], [-330, wy, 0, Math.PI / 2], [330, wy, 0, -Math.PI / 2]];
  for (const [x, y, z, ry] of walls) { const w = new THREE.Mesh(wallGeo, wallMat); w.position.set(x, y, z); w.rotation.y = ry; w.receiveShadow = true; g.add(w); }

  const bmat = new THREE.MeshStandardMaterial({ map: chalkboardTexture(), roughness: 0.9, envMapIntensity: 0.1 });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(240, 90), bmat);
    b.position.set(0, 18, s * 299); b.rotation.y = s > 0 ? Math.PI : 0; g.add(b);
  }
  // bright louvre windows on the left wall
  const wm = new THREE.MeshBasicMaterial({ map: windowTexture(), fog: false }); wm.color.setScalar(1.5);
  for (const z of [-170, 0, 170]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(110, 100), wm); w.position.set(-328.5, 12, z); w.rotation.y = Math.PI / 2; g.add(w); }

  // rows of other desks for depth
  const s = deskSurface('wood', '#a8794a', '#5a3a1f', 99);
  const dm = new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 1, roughness: 0.65 });
  const sm = steel('#2b2e31', 0.45);
  const spots: [number, number][] = [[-115, -110], [-115, 110], [115, -110], [115, 110], [-230, -110], [-230, 110], [230, 0], [-230, 0], [115, 0]];
  for (const [x, z] of spots) { const d = neighbourDesk(dm, sm); d.position.set(x, 0, z); g.add(d); }
  return g;
}

export function disposeTree(o: THREE.Object3D) {
  o.traverse((n: any) => {
    if (n.geometry) n.geometry.dispose();
    const m = n.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((mm: any) => { for (const k of ['map', 'bumpMap', 'roughnessMap']) if (mm[k]) mm[k].dispose(); mm.dispose(); });
  });
}
