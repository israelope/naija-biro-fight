// Every texture is painted on a <canvas> at runtime (seeded, so a table always looks the same).
// No image files are downloaded.
import * as THREE from 'three';

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d')! }; }
function colorTex(c: HTMLCanvasElement, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t;
}
function dataTex(c: HTMLCanvasElement, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
function grain(g: Ctx, S: number, amount: number, R: () => number) {
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const n = (R() - 0.5) * amount; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
}
function blotches(g: Ctx, S: number, R: () => number, n: number, light: string, dark: string, rMin = 60, rMax = 240) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = rMin + R() * (rMax - rMin);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, R() > 0.5 ? light : dark); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function squiggle(g: Ctx, x: number, y: number, len: number, R: () => number) {
  g.beginPath(); g.moveTo(x, y); let a = R() * 6.28;
  for (let i = 0; i < len; i++) { a += (R() - 0.5) * 1.6; x += Math.cos(a) * 4; y += Math.sin(a) * 4; g.lineTo(x, y); }
  g.stroke();
}

/** School-desk wear: scratches, biro doodles, carved initials, mug rings, pen dents. */
function wear(g: Ctx, S: number, R: () => number, intensity = 1) {
  g.lineCap = 'round';
  // fine scratches (a light line with a dark twin, like a real scratch catching light)
  for (let i = 0; i < 140 * intensity; i++) {
    const x = R() * S, y = R() * S, len = 12 + R() * 120, a = (R() > 0.55 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.9;
    const dx = Math.cos(a) * len, dy = Math.sin(a) * len;
    g.lineWidth = 0.5 + R() * 0.7;
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
    g.strokeStyle = 'rgba(255,245,225,0.26)'; g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + dx + 1, y + dy + 1); g.stroke();
  }
  // biro doodles
  const inks = ['rgba(28,48,130,0.55)', 'rgba(20,20,30,0.5)', 'rgba(150,30,35,0.4)'];
  for (let i = 0; i < 9 * intensity; i++) {
    g.strokeStyle = inks[Math.floor(R() * inks.length)]; g.lineWidth = 1 + R() * 0.8;
    const x = R() * S, y = R() * S, k = R();
    if (k < 0.35) squiggle(g, x, y, 30 + R() * 50, R);
    else if (k < 0.55) { for (let t = 0; t < 5; t++) { g.beginPath(); g.moveTo(x + t * 7, y); g.lineTo(x + t * 7 + 1, y + 22); g.stroke(); } g.beginPath(); g.moveTo(x - 4, y + 16); g.lineTo(x + 34, y + 4); g.stroke(); }
    else if (k < 0.75) { g.beginPath(); for (let a = 0; a < 18; a += 0.4) g.lineTo(x + Math.cos(a) * a * 1.6, y + Math.sin(a) * a * 1.6); g.stroke(); }
    else { g.beginPath(); for (let p = 0; p < 10; p++) { const a = (p * Math.PI) / 5, r = p % 2 ? 7 : 16; g.lineTo(x + Math.sin(a) * r, y - Math.cos(a) * r); } g.closePath(); g.stroke(); }
  }
  // handwritten + carved text
  const words = ['SS2 B', 'FC BARCA', 'JAMB 2K25', 'GOD DEY', 'KUNLE', '2PAC', 'BIRO FC', 'MATHS', 'AMAKA', 'ENGLISH'];
  g.font = 'italic 600 22px "Segoe Script","Bradley Hand","Comic Sans MS",cursive';
  for (let i = 0; i < 3 * intensity; i++) {
    g.save(); g.translate(R() * S * 0.85 + 20, R() * S * 0.85 + 30); g.rotate((R() - 0.5) * 0.5);
    g.fillStyle = inks[Math.floor(R() * 2)]; g.fillText(words[Math.floor(R() * words.length)], 0, 0); g.restore();
  }
  g.font = '700 26px Arial,sans-serif';
  for (let i = 0; i < 3; i++) {
    const t = words[Math.floor(R() * words.length)], x = R() * S * 0.8 + 30, y = R() * S * 0.8 + 40;
    g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.3);
    g.fillStyle = 'rgba(255,240,215,0.35)'; g.fillText(t, 1, 1.5);
    g.fillStyle = 'rgba(25,10,0,0.55)'; g.fillText(t, 0, 0); g.restore();
  }
  // mug / bottle rings and pen dents
  for (let i = 0; i < 2; i++) { g.strokeStyle = 'rgba(60,35,15,0.14)'; g.lineWidth = 5 + R() * 3; g.beginPath(); g.arc(R() * S, R() * S, 28 + R() * 14, 0, 6.3); g.stroke(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(R() * S, R() * S, 0.6 + R() * 1.1, 0, 6.3); g.fill(); }
}

function edgeWear(g: Ctx, S: number, w = 46) {
  const sides: [number, number, number, number][] = [[0, 0, 0, w], [0, S, 0, S - w], [0, 0, w, 0], [S, 0, S - w, 0]];
  for (const [x0, y0, x1, y1] of sides) {
    const grd = g.createLinearGradient(x0, y0, x1, y1);
    grd.addColorStop(0, 'rgba(255,235,200,0.22)'); grd.addColorStop(1, 'rgba(255,235,200,0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
  }
}

export interface SurfaceTex { map: THREE.Texture; bump: THREE.Texture }

export function deskSurface(style: string, color: string, accent: string, seed = 7): SurfaceTex {
  const S = 1024, R = rng(seed);
  const { c, g } = canvas(S, S);
  g.fillStyle = color; g.fillRect(0, 0, S, S);

  if (style === 'wood') {
    blotches(g, S, R, 46, 'rgba(255,230,190,0.10)', 'rgba(35,15,0,0.14)');
    for (let i = 0; i < 520; i++) {
      const y = R() * S, amp = 0.6 + R() * 3, f = 0.003 + R() * 0.01, ph = R() * 6;
      g.strokeStyle = R() > 0.5 ? accent : 'rgba(255,232,196,1)'; g.globalAlpha = 0.03 + R() * 0.13; g.lineWidth = 0.4 + R() * 1.7;
      g.beginPath(); for (let x = 0; x <= S; x += 16) { const yy = y + Math.sin(x * f + ph) * amp * 3; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
    }
    g.globalAlpha = 1;
    grain(g, S, 10, R); wear(g, S, R, 1); edgeWear(g, S);
  } else if (style === 'plastic') {
    blotches(g, S, R, 30, 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.06)');
    grain(g, S, 8, R);
    g.lineCap = 'round';
    for (let i = 0; i < 160; i++) { g.strokeStyle = R() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.16)'; g.lineWidth = 0.5 + R(); g.beginPath(); const x = R() * S, y = R() * S, a = R() * 6.28; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (8 + R() * 50), y + Math.sin(a) * (8 + R() * 50)); g.stroke(); }
    wear(g, S, R, 0.35);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,80,40,0.10)'; g.beginPath(); g.ellipse(R() * S, R() * S, 20 + R() * 40, 10 + R() * 30, R() * 3, 0, 6.3); g.fill(); }
  } else if (style === 'concrete') {
    blotches(g, S, R, 70, 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.14)', 40, 200);
    grain(g, S, 46, R);
    for (let i = 0; i < 700; i++) { g.fillStyle = R() > 0.5 ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(R() * S, R() * S, 0.5 + R() * 2.2, 0, 6.3); g.fill(); }
    g.strokeStyle = 'rgba(20,20,20,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let k = 0; k < 24; k++) { x += (R() - 0.35) * 30; y += (R() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
    wear(g, S, R, 0.5);
  } else if (style === 'marble') {
    blotches(g, S, R, 30, 'rgba(255,255,255,0.18)', 'rgba(120,120,130,0.10)');
    for (let i = 0; i < 18; i++) {
      for (const [w, a] of [[5, 0.06], [2.4, 0.16], [0.9, 0.4]] as const) {
        g.strokeStyle = accent; g.globalAlpha = a * (0.5 + R()); g.lineWidth = w;
        g.beginPath(); let x = R() * S, y = 0; g.moveTo(x, y);
        const R2 = rng(seed * 100 + i); while (y < S) { x += (R2() - 0.5) * 50; y += 14 + R2() * 24; g.lineTo(x, y); } g.stroke();
      }
    }
    g.globalAlpha = 1; grain(g, S, 6, R);
  } else { // glass: used as a roughness map (dark = smooth)
    g.fillStyle = '#161616'; g.fillRect(0, 0, S, S);
    blotches(g, S, R, 40, 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.0)');
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(255,255,255,${0.2 + R() * 0.5})`; g.lineWidth = 0.4 + R() * 0.8; g.beginPath(); const x = R() * S, y = R() * S, a = R() * 6.28, l = 10 + R() * 90; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.ellipse(R() * S, R() * S, 8 + R() * 18, 6 + R() * 14, 0, 0, 6.3); g.fill(); }
  }
  return { map: colorTex(c), bump: dataTex(c) };
}

export function floorTexture() {
  const S = 512, R = rng(21);
  const { c, g } = canvas(S, S);
  g.fillStyle = '#6f6e69'; g.fillRect(0, 0, S, S);
  blotches(g, S, R, 40, 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.16)', 30, 160);
  grain(g, S, 34, R);
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(R() * S, R() * S, 0.6 + R() * 1.6, 0, 6.3); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(0, 0, S, S);
  return { map: colorTex(c, 14, 14), bump: dataTex(c, 14, 14) };
}

/** Typical Nigerian classroom wall: cream upper wall, dark-green oil-paint dado, scuffs and grime. */
export function wallTexture() {
  const W = 1024, H = 512, R = rng(33);
  const { c, g } = canvas(W, H);
  const dado = H * 0.62;
  g.fillStyle = '#d8d0b4'; g.fillRect(0, 0, W, dado);
  g.fillStyle = '#1f4a36'; g.fillRect(0, dado, W, H - dado);
  g.fillStyle = '#e9e6d6'; g.fillRect(0, dado - 3, W, 3);
  for (let i = 0; i < 60; i++) {
    const x = R() * W, y = R() * H, r = 40 + R() * 160, grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, R() > 0.5 ? 'rgba(90,70,40,0.10)' : 'rgba(255,255,255,0.06)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
  for (let i = 0; i < 40; i++) { g.beginPath(); const x = R() * W, y = dado + R() * (H - dado); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 80, y + (R() - 0.5) * 12); g.stroke(); }
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, 'rgba(0,0,0,0.25)'); grd.addColorStop(0.25, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) { const n = (R() - 0.5) * 14; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return colorTex(c);
}

export function chalkboardTexture() {
  const W = 1024, H = 384, R = rng(44);
  const { c, g } = canvas(W, H);
  g.fillStyle = '#24372f'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { // ghost smears from the duster
    g.fillStyle = `rgba(210,215,205,${0.02 + R() * 0.05})`; g.save(); g.translate(R() * W, R() * H); g.rotate((R() - 0.5) * 0.6); g.fillRect(0, 0, 80 + R() * 220, 18 + R() * 28); g.restore();
  }
  g.fillStyle = 'rgba(238,240,232,0.9)'; g.font = '44px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';
  g.fillText('Mathematics  –  SS 2', 60, 80);
  g.font = '38px "Segoe Print","Bradley Hand","Comic Sans MS",cursive'; g.fillStyle = 'rgba(238,240,232,0.82)';
  g.fillText('Quadratic equations', 60, 140); g.fillText('x² − 5x + 6 = 0', 60, 200); g.fillText('(x − 2)(x − 3) = 0', 60, 255);
  g.fillStyle = 'rgba(240,226,150,0.85)'; g.fillText('NO NOISE. Assignment Friday.', 60, 330);
  g.fillStyle = 'rgba(238,240,232,0.8)'; g.font = '30px "Segoe Print",cursive'; g.fillText('Date: 12/03', 700, 60);
  g.strokeStyle = '#6b4a2b'; g.lineWidth = 16; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = '#b9b09c'; g.fillRect(8, H - 10, W - 16, 10);
  return colorTex(c);
}

/** Bright louvre window used as a light source in the background. */
export function windowTexture() {
  const { c, g } = canvas(256, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#cfe3f2');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(70,75,70,0.75)'; g.fillRect(0, i * 25.6 + 15, 256, 7); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, i * 25.6 + 22, 256, 2); }
  g.fillStyle = '#4b4f4c'; g.fillRect(0, 0, 256, 8); g.fillRect(0, 248, 256, 8); g.fillRect(0, 0, 8, 256); g.fillRect(248, 0, 8, 256);
  return colorTex(c);
}

/** Printed text along the biro barrel. */
export function penLabel(text: string, ink: string) {
  const { c, g } = canvas(128, 1024);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 1024);
  g.fillStyle = ink; g.font = '700 15px Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const x of [11, 75]) { g.save(); g.translate(x, 540); g.rotate(-Math.PI / 2); g.fillText(text, 0, 0); g.restore(); }
  return colorTex(c);
}

/** Soft radial blob used for contact shadows, dust puffs and highlight rings. */
export function softDisc(alpha = 1) {
  const { c, g } = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(255,255,255,${alpha})`); grd.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.45})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Dashed aim strip texture. */
export function dashTexture() {
  const { c, g } = canvas(64, 16);
  g.fillStyle = 'rgba(255,255,255,1)'; g.fillRect(0, 4, 36, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
