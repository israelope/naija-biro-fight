import * as THREE from 'three';
import { buildPenSpec, getTable, type Loadout, type TableDef } from '@/shared/catalog';
import type { HitEvent, PenSpec, World } from '@/shared/physics';
import { applyEnvironment, buildLouvres, buildPen, buildRoom, buildTable, disposeTree, FLOOR_Y, KEY_POS } from './models';
import { dashTexture, softDisc } from './textures';

export type Quality = 'high' | 'low';
export type CamMode = '3d' | 'top';
export interface Aim { owner: 0 | 1; dx: number; dy: number; power: number }

interface FallState { x: number; y: number; z: number; vx: number; vy: number; vz: number; tilt: number; yaw: number; rest: boolean; knocked: boolean }

/** Soft grey dust puffs kicked up by hard knocks. */
class Dust {
  readonly points: THREE.Points;
  private pos = new Float32Array(60 * 3).fill(-999);
  private vel = new Float32Array(60 * 3);
  private life = new Float32Array(60);
  private i = 0;
  constructor(tex: THREE.Texture) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, color: 0xd8d0bc, size: 5, transparent: true, opacity: 0.32, depthWrite: false, sizeAttenuation: true }));
    this.points.frustumCulled = false;
  }
  puff(x: number, y: number, z: number, n: number, speed: number) {
    for (let k = 0; k < n; k++) {
      const j = this.i++ % 60, a = Math.random() * 6.28, s = (0.2 + Math.random()) * speed * 0.12;
      this.pos.set([x, y, z], j * 3); this.vel.set([Math.cos(a) * s, 6 + Math.random() * 10, Math.sin(a) * s], j * 3); this.life[j] = 0.5 + Math.random() * 0.5;
    }
  }
  update(dt: number) {
    for (let j = 0; j < 60; j++) {
      if (this.life[j] <= 0) continue;
      this.life[j] -= dt;
      if (this.life[j] <= 0) { this.pos[j * 3 + 1] = -999; continue; }
      for (let c = 0; c < 3; c++) { this.pos[j * 3 + c] += this.vel[j * 3 + c] * dt; this.vel[j * 3 + c] *= 0.94; }
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

/**
 * The 3D game view. Sim coordinates (x, y) map to three.js (x, 0, -y); the table top is the y = 0 plane.
 * Physics runs elsewhere; this class only draws what it is told.
 */
export class BiroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 1, 1500);
  private tableGroup: THREE.Group | null = null;
  private tableDef: TableDef;
  private pens: THREE.Group[] = [];
  private blobs: THREE.Mesh[] = [];
  private specs: PenSpec[] = [];
  private fall: (FallState | null)[] = [null, null];
  private ring: THREE.Mesh;
  private aimMesh: THREE.Mesh; private aimTex: THREE.Texture; private aimBack: THREE.Mesh;
  private aim: Aim | null = null;
  private turn: 0 | 1 | null = null;
  private turnMine = true;
  private mySide: 0 | 1 = 0;
  private camMode: CamMode = '3d';
  private shake = 0;
  private dust: Dust;
  private blobTex: THREE.Texture; private ringTex: THREE.Texture;
  private key: THREE.DirectionalLight;
  private env: THREE.Texture;
  private camPos = new THREE.Vector3(0, 120, 90);
  private camInit = false;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private w = 1; private h = 1; private time = 0;
  private ro: ResizeObserver;
  private onFall?: () => void;

  constructor(private canvas: HTMLCanvasElement, private quality: Quality, tableId: string, opts: { onFall?: () => void } = {}) {
    this.onFall = opts.onFall;
    const hi = quality === 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: hi, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = hi;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x15130f);
    this.scene.fog = new THREE.Fog(0x15130f, 240, 620);
    this.env = applyEnvironment(this.renderer, this.scene, 0.55);

    // warm window sunlight (key) + cool bounce from the ceiling lights
    this.key = new THREE.DirectionalLight(0xffeccc, 3.0);
    this.key.position.copy(KEY_POS);
    this.key.castShadow = hi;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0003; this.key.shadow.normalBias = 0.35; this.key.shadow.radius = 5;
    Object.assign(this.key.shadow.camera, { near: 20, far: 420 });
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.HemisphereLight(0xdfe8f5, 0x3a3226, 0.45); this.scene.add(fill);
    const tube = new THREE.PointLight(0xe6f0ff, 900, 260, 1.6); tube.position.set(30, 110, 0); this.scene.add(tube);
    this.scene.add(buildRoom());
    if (hi) this.scene.add(buildLouvres());

    this.blobTex = softDisc(1); this.ringTex = softDisc(0.9);
    this.dust = new Dust(this.blobTex);
    this.scene.add(this.dust.points);

    this.ring = new THREE.Mesh(new THREE.RingGeometry(8.6, 9.4, 64), new THREE.MeshBasicMaterial({ color: 0xe9dcb0, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.05; this.ring.visible = false; this.scene.add(this.ring);

    // projected aim guide: a dashed strip on the desk, plus a faint "stretch" strip behind the pen
    this.aimTex = dashTexture();
    const strip = (map?: THREE.Texture, op = 0.8) => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, color: 0xf3ead2, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
    this.aimMesh = strip(this.aimTex); this.aimBack = strip(undefined, 0.22);
    for (const m of [this.aimMesh, this.aimBack]) { m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 5; this.scene.add(m); }

    this.tableDef = getTable(tableId);
    this.setTable(tableId);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  // ------------------------------------------------------------------ setup
  setTable(id: string) {
    if (this.tableGroup) { this.scene.remove(this.tableGroup); disposeTree(this.tableGroup); }
    this.tableDef = getTable(id);
    this.tableGroup = buildTable(this.tableDef);
    this.scene.add(this.tableGroup);
    const hw = this.tableDef.width / 2 + 14, hd = this.tableDef.depth / 2 + 14, R = Math.max(hw, hd);
    Object.assign(this.key.shadow.camera, { left: -R, right: R, top: R, bottom: -R });
    (this.key.shadow.camera as THREE.OrthographicCamera).updateProjectionMatrix();
    this.key.target.position.set(0, 0, 0);
  }

  setPens(loadouts: [Loadout, Loadout]) {
    this.pens.forEach((p) => { this.scene.remove(p); disposeTree(p); });
    this.blobs.forEach((b) => { this.scene.remove(b); (b.material as THREE.Material).dispose(); b.geometry.dispose(); });
    this.specs = loadouts.map(buildPenSpec);
    this.pens = loadouts.map((l, i) => { const p = buildPen(this.specs[i], l); this.scene.add(p); return p; });
    this.blobs = this.specs.map(() => {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.blobTex, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
      b.rotation.x = -Math.PI / 2; b.renderOrder = 1; this.scene.add(b); return b;
    });
    this.fall = [null, null];
  }

  setMySide(s: 0 | 1) { this.mySide = s; }
  setCameraMode(m: CamMode) { this.camMode = m; }
  setAim(a: Aim | null) { this.aim = a; }
  setTurn(side: 0 | 1 | null, mine: boolean) { this.turn = side; this.turnMine = mine; }
  get tableSpec() { return this.tableDef; }

  hit(e: HitEvent) {
    if (e.speed > 40) this.dust.puff(e.x, 1.2, -e.y, Math.min(8, 2 + Math.floor(e.speed / 30)), e.speed);
    this.shake = Math.min(0.9, this.shake + e.speed / 300);
  }

  /** Pointer position -> table coordinates (cm), or null if the ray misses the table plane. */
  screenToTable(cx: number, cy: number): { x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(ndc, this.camera);
    const pt = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, pt) ? { x: pt.x, y: -pt.z } : null;
  }

  // ------------------------------------------------------------------ frame
  update(world: World, dt: number) {
    this.time += dt;
    for (let i = 0; i < 2; i++) {
      const p = world.pens[i], g = this.pens[i], blob = this.blobs[i];
      if (!p || !g) continue;
      const r = this.specs[i].radius, L = this.specs[i].length;
      if (!p.fallen) {
        this.fall[i] = null;
        g.position.set(p.x, r + 0.02, -p.y);
        const yaw = this.aim && this.aim.owner === i ? Math.atan2(this.aim.dy, this.aim.dx) : Math.atan2(p.dy, p.dx);
        g.rotation.set(0, yaw, 0);
        blob.visible = true; blob.position.set(p.x, 0.04, -p.y); blob.rotation.z = yaw; blob.scale.set(L * 1.25, r * 5, 1);
      } else {
        blob.visible = false;
        let f = this.fall[i];
        if (!f) {
          f = this.fall[i] = { x: p.x, y: r, z: -p.y, vx: p.vx * 0.6, vz: -p.vy * 0.6, vy: 0, tilt: 0, yaw: Math.atan2(p.dy, p.dx), rest: false, knocked: false };
        }
        if (!f.rest) {
          f.vy -= 980 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.z += f.vz * dt;
          f.tilt = Math.min(f.tilt + 4 * dt, 1.5); f.yaw += p.w * dt * 0.5;
          if (f.y < FLOOR_Y + r) {
            f.y = FLOOR_Y + r; f.vy *= -0.32; f.vx *= 0.55; f.vz *= 0.55; f.tilt = 1.5 * (0.5 + Math.random() * 0.5);
            if (!f.knocked) { f.knocked = true; this.onFall?.(); }
            if (Math.abs(f.vy) < 25) f.rest = true;
          }
        }
        g.position.set(f.x, f.y, f.z);
        g.rotation.set(0, f.yaw, f.rest ? 0 : -f.tilt);
      }
    }

    // soft ring marks the pen that is about to be flicked (only for you)
    const tp = this.turn !== null ? world.pens[this.turn] : null;
    if (tp && !tp.fallen && this.turnMine) {
      this.ring.visible = true; this.ring.position.set(tp.x, 0.05, -tp.y);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.time * 3) * 0.12;
    } else this.ring.visible = false;

    this.updateAim(world);
    this.dust.update(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateAim(world: World) {
    const a = this.aim;
    if (!a) { this.aimMesh.visible = false; this.aimBack.visible = false; return; }
    const p = world.pens[a.owner];
    const L = this.specs[a.owner].length;
    const yaw = Math.atan2(a.dy, a.dx);
    const len = 6 + a.power * 58, start = L / 2 + 1.5;
    // strip lies on the desk: mesh rotation.z (after -90deg X) turns it in the table plane
    const place = (m: THREE.Mesh, off: number, length: number, width: number) => {
      m.visible = true; m.rotation.set(-Math.PI / 2, 0, yaw);
      m.position.set(p.x + a.dx * (off + length / 2), 0.06, -p.y - a.dy * (off + length / 2));
      m.scale.set(length, width, 1);
    };
    place(this.aimMesh, start, len, 1.1);
    this.aimTex.repeat.set(len / 5, 1);
    (this.aimMesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + a.power * 0.55;
    place(this.aimBack, -(L / 2 + 1.5 + a.power * 14), a.power * 14, 0.5);
  }

  private updateCamera(dt: number) {
    const aspect = this.w / this.h;
    const tf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const W = this.tableDef.width + 12, D = this.tableDef.depth + 12;
    const portrait = aspect < 0.85;
    const e = THREE.MathUtils.degToRad(this.camMode === 'top' ? 89 : portrait ? 64 : 52);
    const dW = (W * 1.1) / (2 * tf * aspect);
    const dH = ((D * Math.sin(e) + 16 * Math.cos(e)) * 1.12) / (2 * tf);
    const d = Math.max(dW, dH, 60);
    const sgn = this.mySide === 0 ? 1 : -1;
    const want = new THREE.Vector3(0, Math.sin(e) * d, sgn * Math.cos(e) * d);
    if (!this.camInit) { this.camPos.copy(want); this.camInit = true; }
    else this.camPos.lerp(want, 1 - Math.exp(-dt * 4));
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake));
    this.camera.lookAt(0, 0, 0);
  }

  resize() {
    const box = (this.canvas.parentElement ?? this.canvas).getBoundingClientRect();
    this.w = Math.max(1, Math.floor(box.width)); this.h = Math.max(1, Math.floor(box.height));
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.ro.disconnect();
    disposeTree(this.scene);
    [this.blobTex, this.ringTex, this.aimTex, this.env].forEach((t) => t.dispose());
    this.dust.points.geometry.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
