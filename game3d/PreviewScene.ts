import * as THREE from 'three';
import { buildPenSpec, getTable, type Loadout } from '@/shared/catalog';
import { applyEnvironment, buildPen, buildTable, disposeTree, KEY_POS } from './models';

export type PreviewFocus = 'pen' | 'table';

/** Auto-orbiting 3D showcase: shop preview, home screen pen, and the landing-page hero. */
export class PreviewScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 1, 900);
  private content: THREE.Group | null = null;
  private pens: THREE.Group[] = [];
  private focus: PreviewFocus = 'pen';
  private tableW = 70; private tableD = 100;
  private raf = 0; private t = 0; private last = 0; private alive = true;
  private env: THREE.Texture;
  private ro: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private opts: { transparent?: boolean; hero?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.env = applyEnvironment(this.renderer, this.scene, 0.9);
    const key = new THREE.DirectionalLight(0xffeccc, 2.6); key.position.copy(KEY_POS).multiplyScalar(0.7);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.3;
    Object.assign(key.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 400 });
    this.scene.add(key, new THREE.HemisphereLight(0xdfe8f5, 0x3a3226, 0.4));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.alive) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  set(o: { loadout: Loadout; tableId: string; focus: PreviewFocus }) {
    if (this.content) { this.scene.remove(this.content); disposeTree(this.content); }
    this.focus = o.focus; this.pens = [];
    const def = getTable(o.tableId);
    this.tableW = def.width; this.tableD = def.depth;
    const g = new THREE.Group();
    g.add(buildTable(def));
    const spec = buildPenSpec(o.loadout);
    if (o.focus === 'pen') {
      const p = buildPen(spec, o.loadout); p.position.set(0, spec.radius, 0); g.add(p); this.pens.push(p);
    } else {
      for (const s of [-1, 1]) {
        const p = buildPen(spec, o.loadout);
        p.position.set(s * def.width * 0.1, spec.radius, s * (def.depth / 2 - (this.opts.hero ? 22 : 16)));
        p.rotation.y = s > 0 ? Math.PI / 2 + 0.25 : -Math.PI / 2 + 0.15; g.add(p); this.pens.push(p);
      }
    }
    g.traverse((n) => { if ((n as THREE.Mesh).isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    this.content = g; this.scene.add(g);
  }

  private frame() {
    if (this.focus === 'pen') {
      if (this.pens[0]) this.pens[0].rotation.y = this.t * 0.6;
      const a = Math.sin(this.t * 0.4) * 0.3;
      this.camera.position.set(Math.sin(a) * 26, 14, Math.cos(a) * 26);
      this.camera.lookAt(0, 0, 0);
    } else {
      const a = Math.sin(this.t * 0.3) * 0.45;
      const dist = Math.max(this.tableD * 0.95, this.tableW * 1.7) + 14;
      this.camera.position.set(Math.sin(a) * dist * 0.5, dist * (this.opts.hero ? 0.36 : 0.55), Math.cos(a) * dist * 0.8);
      this.camera.lookAt(0, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const box = (this.canvas.parentElement ?? this.canvas).getBoundingClientRect();
    const w = Math.max(1, Math.floor(box.width)), h = Math.max(1, Math.floor(box.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.alive = false; cancelAnimationFrame(this.raf); this.ro.disconnect();
    disposeTree(this.scene); this.env.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
