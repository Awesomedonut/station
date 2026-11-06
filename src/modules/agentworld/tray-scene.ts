import * as THREE from "three";
import { RtsControls } from "./controls";
import type { SceneState } from "@/modules/sheet/agents";
import { drawBlob, type Expression } from "./blob";
import { lookOf, type Unit, type Vec, type World } from "./model";
import type { Pointer, WorldPick } from "./scene";
import type { Theme } from "./themes";
export const TRAY_LABEL: Record<SceneState, string> = {
  waiting: "Needs you",
  running: "Working",
  scheduled: "Looping",
  recent: "Just done",
  resting: "Resting",
  offline: "No signal",
};
export const CRAYON_COLORS = [
  "#9cc3f2",
  "#f6a5b9",
  "#f8d98a",
  "#a8e0c9",
  "#f7c597",
  "#cbb8ee",
  "#bde3b0",
  "#efb3e3",
  "#9fd8ec",
  "#d8b48f",
  "#b9c4d0",
  "#f2a99a",
];
export type MarbleKind = "swirl" | "catseye" | "onyx" | "steel";
export const projectColors = (
  w: World | null,
  _crayon = true,
): Map<string, string> => {
  const pal = CRAYON_COLORS;
  return new Map(
    [...(w?.bases ?? [])]
      .map((b) => b.name)
      .sort()
      .map((n, i) => [n, pal[i % pal.length]]),
  );
};
type Zone = {
  st: SceneState;
  x: number;
  z: number;
  w: number;
  d: number;
  round: boolean;
  el?: HTMLElement;
};
const FACE = Math.atan2(30, 34);
const TOP = 0.04;
function layout(
  _style: "crayon",
  cols: number,
): {
  zones: Zone[];
  disc: number;
  W: number;
  D: number;
} {
  const TW = 5.6,
    TD = 4.4,
    G = 0.36,
    rows = 6 / cols,
    order: SceneState[] =
      cols === 3
        ? ["scheduled", "running", "recent", "resting", "waiting", "offline"]
        : ["running", "scheduled", "recent", "resting", "waiting", "offline"];
  const W = cols * TW + (cols - 1) * G,
    D = rows * TD + (rows - 1) * G;
  return {
    zones: order.map((st, i) => ({
      st,
      x: -W / 2 + TW / 2 + (i % cols) * (TW + G),
      z: -D / 2 + TD / 2 + Math.floor(i / cols) * (TD + G),
      w: TW,
      d: TD,
      round: false,
    })),
    disc: 0,
    W,
    D,
  };
}
function canvasTex(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
let seed = 9;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function crayonTile(color: string) {
  return canvasTex(560, 440, (c) => {
    c.fillStyle = "#fbf6ea";
    c.fillRect(0, 0, 560, 440);
    c.strokeStyle = color;
    c.lineWidth = 7;
    c.lineCap = "round";
    for (let i = -440; i < 560; i += 9) {
      c.globalAlpha = 0.55 + rnd() * 0.35;
      c.beginPath();
      c.moveTo(i + rnd() * 4, 440);
      c.lineTo(i + 440 + rnd() * 4, 0);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.strokeStyle = "#3a3a3a";
    c.lineWidth = 5;
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      (
        [
          [16, 16],
          [544, 16],
          [544, 424],
          [16, 424],
          [16, 16],
        ] as const
      ).forEach(([x, y], i) => {
        const jx = x + (rnd() - 0.5) * 5 + pass * 2,
          jy = y + (rnd() - 0.5) * 5;
        if (i) c.lineTo(jx, jy);
        else c.moveTo(jx, jy);
      });
      c.stroke();
    }
  });
}
function paper() {
  return canvasTex(512, 512, (c) => {
    c.fillStyle = "#f4ecde";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 512,
        y = rnd() * 512,
        l = 2 + rnd() * 7,
        a = rnd() * Math.PI;
      c.strokeStyle =
        rnd() < 0.5 ? "rgba(120,100,70,.06)" : "rgba(255,255,255,.35)";
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
  });
}
function noteTexture(red: string) {
  return canvasTex(128, 128, (c) => {
    c.fillStyle = red;
    c.strokeStyle = "#fff";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(52, 100);
    c.lineTo(64, 122);
    c.lineTo(76, 100);
    c.closePath();
    c.fill();
    c.beginPath();
    c.arc(64, 60, 46, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff";
    c.font = "900 64px system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("!", 64, 63);
  });
}
interface Marble {
  unit: Unit;
  key: string;
  state: SceneState;
  r: number;
  face: string;
  root: THREE.Object3D;
  body: THREE.Object3D;
  note: THREE.Sprite | null;
  halo: THREE.Mesh | null;
  shadow: THREE.Mesh | null;
  frames: THREE.Texture[] | null;
  p: THREE.Vector3;
  v: THREE.Vector3;
  slot: Vec;
  phase: number;
  hopAt: number;
  squash: number;
}
export class TrayScene {
  readonly kind = "tray";
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private controls: RtsControls;
  private tray = new THREE.Group();
  private board = new THREE.Group();
  private fixed = new THREE.Group();
  private marbles = new Map<string, Marble>();
  private zones: Zone[] = [];
  private bounds = { disc: 0, W: 0, D: 0 };
  private overlay: HTMLDivElement;
  private ray = new THREE.Raycaster();
  private selection: THREE.Mesh;
  private selected: string | null = null;
  private hovered: string | null = null;
  private glide: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    t: number;
    z0: number;
    z1: number;
  } | null = null;
  private frame = 0;
  private last = performance.now();
  private lastInput = performance.now();
  private ro: ResizeObserver;
  private inset = 0;
  private fit = 1;
  private cols = 3;
  private textures: THREE.Texture[] = [];
  private blobTex = new Map<string, THREE.Texture>();
  private noteT: THREE.Texture | null = null;
  private first = true;
  bottomInset = 0;
  world: World | null = null;
  constructor(
    private el: HTMLElement,
    private onPick: (p: WorldPick) => void,
    private onHover: (key: string | null) => void = () => {},
    private T: Theme,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);
    this.overlay = document.createElement("div");
    this.overlay.className = "aw-overlay";
    Object.assign(this.overlay.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
    });
    el.appendChild(this.overlay);
    this.tray.rotation.y = FACE;
    this.scene.add(this.fixed, this.tray);
    this.tray.add(this.board);
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.12, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.visible = false;
    this.tray.add(this.selection);
    this.controls = new RtsControls(this.camera, this.renderer.domElement);
    this.controls.zoom = 0.6;
    this.controls.apply();
    this.buildFixed();
    const touched = () => {
      this.lastInput = performance.now();
      this.glide = null;
    };
    this.renderer.domElement.addEventListener("pointerdown", touched);
    this.renderer.domElement.addEventListener("wheel", touched);
    this.renderer.domElement.addEventListener("click", this.onClick);
    this.renderer.domElement.addEventListener("pointermove", this.onMove);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.frame = requestAnimationFrame(this.tick);
  }
  private get style(): "crayon" {
    return "crayon";
  }
  private keep<X extends THREE.Texture>(t: X): X {
    this.textures.push(t);
    return t;
  }
  private buildFixed() {
    for (const c of [...this.fixed.children]) {
      this.fixed.remove(c);
      dispose(c);
    }
    {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.scene.environment = null;
      this.scene.background = new THREE.Color(0xf4ecde);
      const t = this.keep(paper());
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(12, 12);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ map: t }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.6;
      this.fixed.add(ground);
    }
  }
  private buildBoard() {
    for (const c of [...this.board.children]) {
      this.board.remove(c);
      dispose(c);
    }
    for (const z of this.zones) z.el?.remove();
    const L = layout(this.style, this.cols);
    this.zones = L.zones;
    this.bounds = { disc: L.disc, W: L.W, D: L.D };
    {
      const W = L.W + 1.6,
        D = L.D + 1.6,
        box = new THREE.Mesh(
          new THREE.BoxGeometry(W, 0.6, D),
          new THREE.MeshBasicMaterial({ color: 0xfbf7ef }),
        );
      box.position.y = -0.3;
      this.board.add(box);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(box.geometry),
        new THREE.LineBasicMaterial({ color: 0x3a3a3a }),
      );
      edge.position.copy(box.position);
      this.board.add(edge);
      const drop = new THREE.Mesh(
        new THREE.PlaneGeometry(W, D),
        new THREE.MeshBasicMaterial({
          color: 0x3a3a3a,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
      drop.rotation.x = -Math.PI / 2;
      drop.position.set(0.5, -0.59, 0.6);
      this.board.add(drop);
      for (const z of this.zones) {
        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(z.w, z.d),
          new THREE.MeshBasicMaterial({
            map: this.keep(crayonTile(this.T.crayons[z.st])),
          }),
        );
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(z.x, 0.005, z.z);
        this.board.add(tile);
        z.el = this.label(z.st, "aw-crayon");
      }
    }
  }
  private label(st: SceneState, cls: string) {
    const el = document.createElement("div");
    el.className = `aw-tag aw-zone ${cls}`;
    if (st === "waiting") el.classList.add("aw-zone-red");
    this.overlay.appendChild(el);
    return el;
  }
  setTheme(theme: Theme) {
    if (theme.id === this.T.id) return;
    this.T = theme;
    this.noteT = null;
    this.buildFixed();
    this.buildBoard();
    if (this.world) this.setWorld(this.world, true);
  }
  private blobFrames(
    color: string,
    face: Expression,
    grey: boolean,
    i: number,
  ): THREE.Texture[] {
    return [0, 1, 2].map((f) => {
      const key = `${color}:${face}:${grey}:${i % 5}:${f}`;
      let t = this.blobTex.get(key);
      if (!t) {
        t = canvasTex(256, 256, (c) =>
          drawBlob(c, 128, 136, 170, color, face, {
            seed: (i % 5) * 3 + f + 1,
            phase: f / 3,
            grey,
            ink: this.T.blob,
          }),
        );
        this.blobTex.set(key, t);
      }
      return t;
    });
  }
  setWorld(w: World, rebuild = false) {
    this.world = w;
    const cols = (this.el.clientWidth || 1) < 760 ? 2 : 3;
    if (cols !== this.cols || !this.zones.length || rebuild) {
      this.cols = cols;
      this.buildBoard();
    }
    const crayon = this.style === "crayon",
      colors = projectColors(w, crayon),
      now = performance.now() / 1000;
    const byState = new Map<SceneState, Unit[]>();
    for (const u of w.units) {
      const s = u.agent.state;
      if (!byState.has(s)) byState.set(s, []);
      byState.get(s)!.push(u);
    }
    const most = Math.max(1, ...[...byState.values()].map((l) => l.length)),
      area = this.zones.reduce(
        (a, z) => Math.min(a, z.round ? Math.PI * (z.w / 2) ** 2 : z.w * z.d),
        Infinity,
      );
    const r0 = Math.max(0.26, Math.min(0.5, Math.sqrt(area / (most * 5.2))));
    const keep = new Set<string>();
    for (const [st, list] of byState) {
      const z = this.zones.find((x) => x.st === st);
      if (!z) continue;
      list.sort(
        (a, b) =>
          (b.agent.tasksDone || 0) - (a.agent.tasksDone || 0) ||
          a.agent.key.localeCompare(b.agent.key),
      );
      list.forEach((u, i) => {
        const key = u.agent.key;
        keep.add(key);
        const ga = i * 2.39996,
          rr = Math.sqrt(i + 0.5) / Math.sqrt(list.length + 0.5),
          dz = 0.7,
          slot = {
            x: z.x + Math.cos(ga) * rr * (z.w / 2 - 0.65),
            z: z.z + z.d * 0.14 + Math.sin(ga) * rr * (z.d / 2 - 0.65) * dz,
          };
        const r =
            r0 * (1 + Math.min(0.35, (u.agent.tasksDone || 0) * 0.03)) * 1,
          color = colors.get(u.base) ?? CRAYON_COLORS[0];
        const look = lookOf(u.agent),
          old = this.marbles.get(key);
        if (
          old &&
          old.state === st &&
          Math.abs(old.r - r) < 0.01 &&
          old.face === look.face &&
          !rebuild
        ) {
          old.unit = u;
          old.slot = slot;
          old.root.userData.unit = u;
          return;
        }
        let root: THREE.Object3D,
          body: THREE.Object3D,
          frames: THREE.Texture[] | null = null,
          shadow: THREE.Mesh | null = null;
        {
          frames = this.blobFrames(color, look.face, look.grey, i);
          const s = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: frames[0],
              transparent: true,
              depthWrite: false,
            }),
          );
          s.scale.set(r * 3.1, r * 3.1, 1);
          s.center.set(0.5, 0.2);
          s.renderOrder = 10;
          root = new THREE.Group();
          root.add(s);
          body = s;
          shadow = new THREE.Mesh(
            new THREE.CircleGeometry(r * 0.85, 24),
            new THREE.MeshBasicMaterial({
              color: 0x3a3a3a,
              transparent: true,
              opacity: 0.16,
              depthWrite: false,
            }),
          );
          shadow.rotation.x = -Math.PI / 2;
          this.tray.add(shadow);
        }
        root.userData.unit = u;
        this.tray.add(root);
        let note: THREE.Sprite | null = null,
          halo: THREE.Mesh | null = null;
        if (st === "waiting") {
          note = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: this.noteTex(),
              depthWrite: false,
              toneMapped: false,
            }),
          );
          note.scale.set(0.85, 0.85, 1);
          note.renderOrder = 20;
          root.add(note);
        }
        const p = old
          ? old.p.clone()
          : new THREE.Vector3(
              slot.x + (Math.random() - 0.5),
              6 + Math.random() * 5,
              slot.z + (Math.random() - 0.5),
            );
        const v = old
          ? old.v.clone().setY(old.state !== st ? 6 : 0)
          : new THREE.Vector3();
        if (old) this.drop(old);
        this.marbles.set(key, {
          unit: u,
          key,
          state: st,
          r,
          face: look.face,
          root,
          body,
          note,
          halo,
          shadow,
          frames,
          p,
          v,
          slot,
          phase: (key.length * 1.37 + i) % 6.28,
          hopAt: now + 1 + Math.random() * 3,
          squash: 0,
        });
      });
    }
    for (const [k, m] of this.marbles)
      if (!keep.has(k)) {
        this.drop(m);
        this.marbles.delete(k);
      }
    for (const z of this.zones) {
      const n = byState.get(z.st)?.length ?? 0;
      if (z.el) {
        z.el.innerHTML = `<b>${TRAY_LABEL[z.st]}</b><span>${n}</span>`;
        z.el.classList.toggle("aw-zone-empty", n === 0);
      }
    }
    this.measureFit();
    if (this.first) {
      this.glide = {
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        t: 0,
        z0: this.fit * 0.75,
        z1: this.fit,
      };
      this.first = false;
    }
    if (this.selected && !this.marbles.has(this.selected)) this.select(null);
  }
  private noteTex() {
    return (this.noteT ??= this.keep(noteTexture(this.T.red)));
  }
  private drop(m: Marble) {
    for (const o of [m.root, m.shadow, m.halo])
      if (o) {
        this.tray.remove(o);
        dispose(o);
      }
  }
  private measureFit() {
    const cw = this.el.clientWidth || 1,
      ch = this.el.clientHeight || 1,
      inset = cw > 900 ? this.inset : 0,
      viewW = 19.2 * ((cw - inset) / ch),
      viewH = 19.2;
    const W = this.bounds.disc
        ? this.bounds.disc * 2 + 1.8
        : this.bounds.W + 2.8,
      D = this.bounds.disc ? this.bounds.disc * 2 + 1.8 : this.bounds.D + 1.6;
    this.fit = Math.max(
      0.2,
      Math.min(
        2.2,
        Math.min(
          (viewW * 0.94) / W,
          (viewH * (cw < 760 ? 0.62 : 0.86)) / (D * 0.66 + 2.6),
        ),
      ),
    );
  }
  setInset(px: number) {
    if (px === this.inset) return;
    this.inset = px;
    this.resize();
    if (this.world) {
      this.measureFit();
      if (!this.glide) this.home();
    }
  }
  home() {
    this.focus({ x: 0, z: 0 }, this.fit);
  }
  focus(p: THREE.Vector3 | Vec, zoom = this.controls.zoom) {
    const to =
      p instanceof THREE.Vector3
        ? p.clone().setY(0)
        : new THREE.Vector3(p.x, 0, p.z);
    this.glide = {
      from: this.controls.focus.clone(),
      to,
      t: 0,
      z0: this.controls.zoom,
      z1: zoom,
    };
  }
  select(key: string | null, glide = true) {
    this.selected = key;
    const m = key ? this.marbles.get(key) : undefined;
    this.selection.visible = !!m;
    if (m && glide)
      this.focus(
        this.tray.localToWorld(m.p.clone()),
        Math.max(this.fit * 1.5, 1),
      );
  }
  private worldOf(m: Marble, y = 0) {
    return this.tray.localToWorld(new THREE.Vector3(m.p.x, m.p.y + y, m.p.z));
  }
  screenOf(key: string): {
    x: number;
    y: number;
  } | null {
    const m = this.marbles.get(key);
    if (!m) return null;
    const r = this.renderer.domElement.getBoundingClientRect(),
      p = this.worldOf(m, m.r).project(this.camera);
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height };
  }
  askerPointers(): Pointer[] {
    const r = this.renderer.domElement.getBoundingClientRect();
    return [...this.marbles.values()]
      .filter((m) => m.state === "waiting")
      .map((m) => {
        const p = this.worldOf(m).project(this.camera),
          x = ((p.x + 1) / 2) * r.width,
          y = ((1 - p.y) / 2) * r.height;
        return {
          key: m.key,
          x,
          y,
          onScreen: x > 40 && y > 70 && x < r.width - 40 && y < r.height - 40,
        };
      });
  }
  private hit(ev: MouseEvent): Unit | null {
    const r = this.renderer.domElement.getBoundingClientRect(),
      ndc = new THREE.Vector2(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1,
      );
    this.ray.setFromCamera(ndc, this.camera);
    this.ray.camera = this.camera;
    for (const h of this.ray.intersectObjects(
      [...this.marbles.values()].map((m) => m.root),
      true,
    )) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.unit) o = o.parent;
      if (o) return o.userData.unit as Unit;
    }
    return null;
  }
  private onMove = (ev: PointerEvent) => {
    const u = this.hit(ev),
      key = u?.agent.key ?? null;
    this.renderer.domElement.style.cursor = u ? "pointer" : "grab";
    if (key !== this.hovered) {
      this.hovered = key;
      this.onHover(key);
    }
  };
  private onClick = (ev: MouseEvent) => {
    if (this.controls.wasDrag) return;
    const u = this.hit(ev);
    if (u) {
      this.select(u.agent.key);
      this.onPick({ kind: "unit", unit: u });
    } else {
      this.select(null);
      this.onPick(null);
    }
  };
  private resize() {
    const w = this.el.clientWidth || 1,
      h = this.el.clientHeight || 1,
      half = 9.6;
    this.renderer.setSize(w, h);
    Object.assign(this.camera, {
      left: (-half * w) / h,
      right: (half * w) / h,
      top: half,
      bottom: -half,
    });
    const inset = w > 900 ? this.inset : 0;
    if (inset) this.camera.setViewOffset(w, h, -inset / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    if (this.world && (w < 760 ? 2 : 3) !== this.cols)
      this.setWorld(this.world);
    if (
      this.world &&
      performance.now() - this.lastInput > 3000 &&
      !this.glide
    ) {
      this.measureFit();
      this.controls.zoom = this.fit;
      this.controls.apply();
    }
  }
  private wall(m: Marble) {
    if (this.bounds.disc) {
      const d = Math.hypot(m.p.x, m.p.z),
        max = this.bounds.disc - m.r;
      if (d > max) {
        const nx = m.p.x / d,
          nz = m.p.z / d;
        m.p.x = nx * max;
        m.p.z = nz * max;
        const vn = m.v.x * nx + m.v.z * nz;
        if (vn > 0) {
          m.v.x -= nx * vn * 1.4;
          m.v.z -= nz * vn * 1.4;
        }
      }
      return;
    }
    const lx = this.bounds.W / 2 - m.r,
      lz = this.bounds.D / 2 - m.r;
    if (Math.abs(m.p.x) > lx) {
      m.p.x = Math.sign(m.p.x) * lx;
      m.v.x *= -0.4;
    }
    if (Math.abs(m.p.z) > lz) {
      m.p.z = Math.sign(m.p.z) * lz;
      m.v.z *= -0.4;
    }
  }
  private tick = () => {
    const nowMs = performance.now(),
      dt = Math.min(0.12, (nowMs - this.last) / 1000),
      t = nowMs / 1000;
    this.last = nowMs;
    if (this.glide) {
      const g = this.glide;
      g.t = Math.min(1, g.t + dt * 1.4);
      const e = g.t * g.t * (3 - 2 * g.t);
      this.controls.focus.copy(g.from).lerp(g.to, e);
      this.controls.zoom = g.z0 + (g.z1 - g.z0) * e;
      this.controls.apply();
      if (g.t >= 1) this.glide = null;
    } else this.controls.update(dt);
    const list = [...this.marbles.values()],
      steps = Math.max(1, Math.ceil(dt / 0.012));
    for (let step = 0; step < steps; step++) {
      const h = dt / steps;
      for (const m of list) {
        let tx = m.slot.x,
          tz = m.slot.z;
        if (m.state === "scheduled") {
          tx += Math.cos(t * 1.1 + m.phase) * 0.42;
          tz += Math.sin(t * 1.1 + m.phase) * 0.42;
        } else if (m.state === "running") {
          tx += Math.sin(t * 2.3 + m.phase) * 0.2;
          tz += Math.cos(t * 1.7 + m.phase * 2) * 0.16;
        }
        const ground = m.p.y <= m.r + TOP + 0.001;
        m.v.x += ((tx - m.p.x) * 7 - m.v.x * 4.2) * h;
        m.v.z += ((tz - m.p.z) * 7 - m.v.z * 4.2) * h;
        m.v.y -= 32 * h;
        m.p.addScaledVector(m.v, h);
        if (m.p.y < m.r + TOP) {
          m.p.y = m.r + TOP;
          if (m.v.y < -2) {
            m.squash = Math.min(0.25, -m.v.y * 0.025);
            m.v.y = -m.v.y * 0.32;
          } else m.v.y = 0;
        }
        if (
          ground &&
          (m.state === "waiting" || m.state === "recent") &&
          t > m.hopAt
        ) {
          m.v.y = m.state === "waiting" ? 6.2 : 4.8;
          m.hopAt =
            t +
            (m.state === "waiting"
              ? 0.9 + Math.random() * 0.5
              : 3 + Math.random() * 3);
        }
        this.wall(m);
      }
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i],
            b = list[j],
            dx = b.p.x - a.p.x,
            dz = b.p.z - a.p.z,
            dy = b.p.y - a.p.y,
            d = Math.hypot(dx, dz, dy),
            min = (a.r + b.r) * 0.98;
          if (d < min && d > 1e-4) {
            const nx = dx / d,
              nz = dz / d,
              push = (min - d) / 2;
            a.p.x -= nx * push;
            a.p.z -= nz * push;
            b.p.x += nx * push;
            b.p.z += nz * push;
            const rel = (b.v.x - a.v.x) * nx + (b.v.z - a.v.z) * nz;
            if (rel < 0) {
              const k = rel * 0.8;
              a.v.x += nx * k;
              a.v.z += nz * k;
              b.v.x -= nx * k;
              b.v.z -= nz * k;
            }
          }
        }
    }
    const boil = Math.floor(t * 8) % 3;
    for (const m of list) {
      m.root.position.copy(m.p);
      const sp = Math.hypot(m.v.x, m.v.z);
      m.squash *= Math.pow(0.002, dt);
      if (m.frames) {
        const s = m.body as THREE.Sprite;
        s.material.map = m.frames[(boil + Math.floor(m.phase)) % 3];
        s.material.rotation = THREE.MathUtils.clamp(-m.v.x * 0.05, -0.35, 0.35);
        const k = m.r * 3.1;
        s.scale.set(k * (1 + m.squash * 0.6), k * (1 - m.squash), 1);
        s.position.y = -m.r;
        if (m.shadow) {
          m.shadow.position.set(m.p.x, TOP + 0.01, m.p.z);
          m.shadow.scale.setScalar(Math.max(0.4, 1 - (m.p.y - m.r) * 0.25));
        }
      } else {
        if (sp > 0.02)
          m.body.quaternion.premultiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(m.v.z, 0, -m.v.x).normalize(),
              (sp * dt) / m.r,
            ),
          );
        else if (m.state === "running") m.body.rotateY(dt * 1.5);
        m.root.scale.set(1 + m.squash * 0.5, 1 - m.squash, 1 + m.squash * 0.5);
      }
      if (m.note)
        m.note.position.y =
          (m.frames ? m.r * 1.9 : m.r * 1.6) +
          0.45 +
          Math.sin(t * 4 + m.phase) * 0.06;
      if (m.halo) {
        m.halo.position.set(m.p.x, TOP + 0.01, m.p.z);
        const k = (Math.sin(t * 3 + m.phase) + 1) / 2;
        (m.halo.material as THREE.MeshBasicMaterial).opacity = 0.35 + k * 0.5;
        m.halo.scale.setScalar(0.9 + k * 0.2);
      }
      if (this.selected === m.key) {
        this.selection.position.set(m.p.x, TOP + 0.012, m.p.z);
        this.selection.scale.setScalar(m.r * 1.3);
      }
    }
    this.placeTags();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };
  private placeTags() {
    const w = this.el.clientWidth,
      h = this.el.clientHeight;
    for (const z of this.zones) {
      if (!z.el) continue;
      const p = this.tray
          .localToWorld(
            new THREE.Vector3(
              z.x,
              TOP,
              z.z + z.d / 2 + (z.round ? 0.25 : -0.05),
            ),
          )
          .project(this.camera),
        x = ((p.x + 1) / 2) * w,
        y = ((1 - p.y) / 2) * h;
      z.el.style.display =
        w < 760 && this.bottomInset && y > h - this.bottomInset ? "none" : "";
      z.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener("click", this.onClick);
    this.renderer.domElement.removeEventListener("pointermove", this.onMove);
    dispose(this.scene);
    for (const t of [...this.textures, ...this.blobTex.values()]) t.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }
}
function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mm = m.material as THREE.Material | THREE.Material[] | undefined;
    for (const x of Array.isArray(mm) ? mm : mm ? [mm] : []) x.dispose();
  });
}
