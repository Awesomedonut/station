import * as THREE from "three";
import { alongPath, RtsControls } from "./controls";
import { drawBlob, type Expression } from "./blob";
import {
  lookOf,
  STATE_LABEL,
  type Base,
  type Unit,
  type Vec,
  type World,
} from "./model";
import { THEMES, type Theme } from "./themes";
export type WorldPick =
  | {
      kind: "unit";
      unit: Unit;
    }
  | {
      kind: "base";
      base: Base;
    }
  | null;
export type Pointer = {
  key: string;
  x: number;
  y: number;
  onScreen: boolean;
};
let T: Theme = THEMES.donut;
const POST = { x: -2.1, z: -0.1 };
const v3 = (p: Vec, y = 0) => new THREE.Vector3(p.x, y, p.z);
const flat = (color: THREE.ColorRepresentation) =>
  new THREE.MeshLambertMaterial({ color, flatShading: false });
const groundAt = (_x: number, _z: number) => 0;
const cache = new Map<string, THREE.CanvasTexture>();
function tex(
  key: string,
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
  repeat = false,
): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  let cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;

  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  cache.set(key, t);
  return t;
}
let seedN = 3;
const rnd = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;
function paperTexture() {
  return tex(
    "paper",
    512,
    512,
    (c) => {
      const g = T.ground;
      c.fillStyle = g.paper;
      c.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 2600; i++) {
        const x = rnd() * 512,
          y = rnd() * 512,
          l = 2 + rnd() * 7,
          a = rnd() * Math.PI;
        c.strokeStyle = rnd() < 0.5 ? g.grain[0] : g.grain[1];
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        c.stroke();
      }
    },
    true,
  );
}
function islandTexture(tint: string, k: number) {
  return tex(`island:${tint}:${k}`, 512, 512, (c) => {
    const R = 236,
      pts: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2,
        r =
          R *
          (0.93 + 0.05 * Math.sin(a * 3 + k) + 0.02 * Math.sin(a * 7 + k * 2));
      pts.push([256 + Math.cos(a) * r, 256 + Math.sin(a) * r]);
    }
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = tint;
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = T.island.hatch;
    c.lineWidth = 4;
    for (let i = 0; i < 150; i++) {
      const a = rnd() * Math.PI * 2,
        r = R * (0.8 + rnd() * 0.14),
        x = 256 + Math.cos(a) * r,
        y = 256 + Math.sin(a) * r;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 14, y - 10);
      c.stroke();
    }
    c.restore();
    c.save();
    c.clip();
    c.lineWidth = 3;
    for (let i = 0; i < 700; i++) {
      const x = rnd() * 512,
        y = rnd() * 512;
      c.strokeStyle = rnd() < 0.5 ? T.island.speck[0] : T.island.speck[1];
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 18 * (rnd() - 0.2), y - 12 * rnd());
      c.stroke();
    }
    c.restore();
    c.save();
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.clip();
    c.restore();
    c.strokeStyle = T.island.edge;
    c.lineWidth = 5;
    c.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = (rnd() - 0.5) * 3,
          jy = (rnd() - 0.5) * 3;
        if (i) c.lineTo(x + jx, y + jy);
        else c.moveTo(x + jx, y + jy);
      });
      c.stroke();
    }
  });
}
function treeTexture(k: number) {
  return tex(`tree:${k}`, 256, 320, (c) => {
    c.lineCap = "round";
    c.strokeStyle = T.trees.line;
    c.translate(0, 150);
    const greens = T.trees.fills;
    for (let i = 0; i < 3; i++) {
      const x = 128 + (i - 1) * 46,
        y = 130 - (i === 1 ? 40 : 0),
        r = 70 - (i === 1 ? 0 : 14);
      c.beginPath();
      for (let j = 0; j <= 30; j++) {
        const a = (j / 30) * Math.PI * 2,
          rr = r * (0.9 + 0.1 * Math.sin(a * 5 + k + i));
        if (j) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9);
        else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9);
      }
      c.closePath();
      c.fillStyle = greens[(i + k) % 3];
      c.fill();
      c.lineWidth = 5;
      c.stroke();
    }
  });
}
function ringTexture(kind: "solid" | "dash" | "dot" | "red") {
  return tex(`ring:${kind}`, 256, 256, (c) => {
    c.strokeStyle = T.island.edge;
    c.lineCap = "round";
    c.lineWidth = 7;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2 + 0.2,
        r = 104 * (1 + 0.025 * Math.sin(a * 3) + 0.015 * Math.sin(a * 7));
      pts.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.98]);
    }
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.lineTo(pts[3][0], pts[3][1]);
    c.stroke();
  });
}
function loopTexture() {
  return tex("loop", 128, 128, (c) => {
    c.strokeStyle = T.loop;
    c.fillStyle = T.loop;
    c.lineWidth = 10;
    c.lineCap = "round";
    c.beginPath();
    c.arc(64, 64, 40, 0.3, Math.PI * 1.75);
    c.stroke();
    const a = Math.PI * 1.75,
      x = 64 + Math.cos(a) * 40,
      y = 64 + Math.sin(a) * 40;
    c.beginPath();
    c.moveTo(x + 18, y - 4);
    c.lineTo(x - 4, y - 16);
    c.lineTo(x - 2, y + 10);
    c.closePath();
    c.fill();
  });
}
const groundSprite = (t: THREE.Texture, size: number, opacity = 1) => {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
};
function blobFrame(
  look: {
    face: Expression;
    crayon: string;
    grey: boolean;
  },
  seed: number,
  frame: number,
  note: boolean,
  laptop = false,
  role?: string,
) {
  return tex(
    `blob:${look.face}:${look.crayon}:${look.grey}:${seed % 5}:${frame}:${note}:${laptop}:${role ?? ""}`,
    256,
    300,
    (c) => {
      drawBlob(c, 128, 150, 170, look.crayon, look.face, {
        seed: (seed % 5) * 3 + frame + 1,
        phase: frame / 3,
        grey: look.grey,
        laptop,
        ink: T.blob,
        role,
      });
      if (note) {
        c.save();
        c.translate(158, -4);
        c.fillStyle = T.red;
        c.strokeStyle = "#ffffff";
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(60, 78);
        c.lineTo(78, 102);
        c.lineTo(76, 70);
        c.closePath();
        c.fill();
        c.beginPath();
        c.arc(46, 44, 38, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = "#ffffff";
        c.font = "900 56px system-ui, sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("!", 46, 47);
        c.restore();
      }
    },
  );
}
const esc = (x: string) =>
  x.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
const t0ok = (l: { born: number }) => performance.now() / 1000 >= l.born;
const sprite = (t: THREE.Texture, w: number, h: number, order = 10) => {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  s.scale.set(w, h, 1);
  s.renderOrder = order;
  return s;
};
const shadowDisc = (r: number) => {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshBasicMaterial({
      color: T.shadow.color,
      transparent: true,
      opacity: T.shadow.opacity,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
};
function outlined(mesh: THREE.Mesh, angle = 20): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh);
  const e = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, angle),
    new THREE.LineBasicMaterial({ color: T.house.edge }),
  );
  e.position.copy(mesh.position);
  e.rotation.copy(mesh.rotation);
  e.scale.copy(mesh.scale);
  g.add(e);
  return g;
}
function house(b: Base, k: number, lit: boolean): THREE.Group {
  const s = 0.74 + Math.min(b.total, 8) * 0.05;
  const g = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(2.1 * s, 1.4 * s, 1.7 * s),
    flat(T.house.walls),
  );
  walls.position.y = 0.7 * s;
  g.add(outlined(walls));
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.7 * s, 1.0 * s, 4),
    flat(T.house.roofs[k % T.house.roofs.length]),
  );
  roof.position.y = 1.9 * s;
  roof.rotation.y = Math.PI / 4;
  g.add(outlined(roof));
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42 * s, 0.7 * s),
    flat(T.house.door),
  );
  door.position.set(0, 0.36 * s, 0.86 * s);
  g.add(door);
  for (const x of [-0.62, 0.62]) {
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36 * s, 0.34 * s),
      new THREE.MeshBasicMaterial({ color: lit ? T.house.lit : T.house.dark }),
    );
    w.position.set(x * s, 0.86 * s, 0.86 * s);
    g.add(w);
  }
  return g;
}
interface Tag {
  el: HTMLElement;
  at: () => THREE.Vector3;
  show: () => boolean;
  dy: number;
  rank: number;
  below?: boolean;
  foot?: boolean;
}
interface Live {
  gy: number;
  home: {
    x: number;
    z: number;
    r: number;
  } | null;
  nudge: {
    x: number;
    z: number;
  };
  unit: Unit;
  sprite: THREE.Sprite;
  frames: THREE.Texture[];
  shadow: THREE.Mesh;
  ring: THREE.Object3D;
  pill: HTMLElement;
  alert: HTMLElement | null;
  loop: THREE.Sprite | null;
  from: THREE.Vector3 | null;
  to: THREE.Vector3;
  t0: number;
  phase: number;
  route: THREE.Vector3[] | null;
  length: number;
  born: number;
  head: THREE.Vector3;
}
interface Piece {
  obj: THREE.Object3D;
  born: number;
  scale: THREE.Vector3;
}
interface Confetto {
  m: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
}
export class AgentWorldScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private controls: RtsControls;
  private dynamic = new THREE.Group();
  private units: Live[] = [];
  private pieces: Piece[] = [];
  private bases: {
    base: Base;
    card: HTMLElement;
    group: THREE.Group;
  }[] = [];
  private pings: THREE.Mesh[] = [];
  private marches: THREE.Mesh[] = [];
  private confetti: Confetto[] = [];
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
  private ray = new THREE.Raycaster();
  private prev = new Map<
    string,
    {
      state: string;
      atCommand: boolean;
      pos: THREE.Vector3;
    }
  >();
  private first = true;
  private fixed = new THREE.Group();
  private inset = 0;
  bottomInset = 0;
  private fit = 1;
  private overlay: HTMLDivElement;
  private tags: Tag[] = [];
  private fixedTags: Tag[] = [];
  world: World | null = null;
  constructor(
    private el: HTMLElement,
    private onPick: (p: WorldPick) => void,
    private onHover: (key: string | null) => void = () => {},
    theme: Theme = THEMES.donut,
  ) {
    if (theme.id !== T.id) {
      for (const x of cache.values()) x.dispose();
      cache.clear();
      T = theme;
    }
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);
    this.scene.add(this.fixed);
    this.buildFixed();
    this.overlay = document.createElement("div");
    this.overlay.className = "aw-overlay";
    Object.assign(this.overlay.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
    });
    el.appendChild(this.overlay);
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(1.32, 1.4, 48),
      new THREE.MeshBasicMaterial({
        color: T.island.edge,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.y = 0.04;
    this.selection.visible = false;
    this.scene.add(this.selection);
    this.scene.add(this.dynamic);
    this.controls = new RtsControls(this.camera, this.renderer.domElement);
    this.controls.zoom = 0.6;
    this.controls.apply();
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
  private buildFixed() {
    for (const c of [...this.fixed.children]) {
      this.fixed.remove(c);
      disposeTree(c);
    }
    this.scene.background = new THREE.Color(T.ground.paper);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.scene.environment = null;
    this.scene.environmentIntensity = 0.45;
    this.scene.fog = null;
    this.fixed.add(
      new THREE.HemisphereLight(T.light.sky, T.light.ground, T.light.hemi),
    );
    const sun = new THREE.DirectionalLight(0xffffff, T.light.sun);
    sun.position.set(14, 26, 8);
    this.fixed.add(sun);
    const t = paperTexture();
    t.repeat.set(14, 14);
    {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(260, 260),
        new THREE.MeshBasicMaterial({ map: t }),
      );
      ground.rotation.x = -Math.PI / 2;
      this.fixed.add(ground);
    }

    const post = new THREE.Group();
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 48),
      new THREE.MeshBasicMaterial({
        map: islandTexture(T.island.plaza, 99),
        transparent: true,
      }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.012;
    post.add(plaza);
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.3, 1.6),
      flat(T.house.walls),
    );
    hut.position.set(-2.5, 0.65, -2.5);
    {
      post.add(outlined(hut));
      const hr = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 0.9, 4),
        flat(T.house.roofs[0]),
      );
      hr.position.set(-2.5, 1.75, -2.5);
      hr.rotation.y = Math.PI / 4;
      post.add(outlined(hr));
    }
    this.fixed.add(post);
    if (this.selection)
      (this.selection.material as THREE.MeshBasicMaterial).color.set(
        T.island.edge,
      );
  }
  setTheme(theme: Theme) {
    if (theme.id === T.id) return;
    T = theme;
    const old = [...cache.values()];
    cache.clear();
    this.buildFixed();
    if (this.world) this.setWorld(this.world);
    for (const x of old) x.dispose();
  }
  setWorld(w: World) {
    this.world = w;
    for (const c of [...this.dynamic.children]) {
      this.dynamic.remove(c);
      disposeTree(c);
    }
    this.units = [];
    this.bases = [];
    this.pings = [];
    this.pieces = [];
    this.marches = [];
    for (const tg of this.tags) tg.el.remove();
    this.tags = [];
    const now = performance.now() / 1000,
      intro = this.first;
    const add = (o: THREE.Object3D, delay: number) => {
      this.dynamic.add(o);
      this.pieces.push({
        obj: o,
        born: now + (intro ? delay : 0),
        scale: o.scale.clone(),
      });
      if (intro) o.scale.setScalar(0.0001);
    };
    const st = new THREE.Group();
    {
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.6, 2.1),
        flat(T.house.walls),
      );
      sw.position.y = 0.8;
      st.add(outlined(sw));
      const sr = new THREE.Mesh(
        new THREE.ConeGeometry(2.05, 1.1, 4),
        flat(T.house.roofs[1]),
      );
      sr.position.y = 2.15;
      sr.rotation.y = Math.PI / 4;
      st.add(outlined(sr));
    }
    {
      st.position.copy(v3(w.station));
      const sti = new THREE.Mesh(
        new THREE.CircleGeometry(2.6, 40),
        new THREE.MeshBasicMaterial({
          map: islandTexture(T.island.fills[0], 77),
          transparent: true,
        }),
      );
      sti.rotation.x = -Math.PI / 2;
      sti.position.y = -0.79 + 0.8;
      st.add(sti);
    }
    add(st, 0.1);
    const stTag = this.tag("aw-sign", "Station"),
      stAt = v3(w.station, 3.0);
    this.tags.push({
      el: stTag,
      at: () => stAt,
      show: () => true,
      dy: 0,
      rank: 2,
    });
    const dash = new THREE.MeshBasicMaterial({
      color: T.road.color,
      transparent: true,
      opacity: T.road.opacity,
    });
    const road = (a: Vec, b: Vec, r0 = 4.6, r1 = 0) => {
      const d = Math.hypot(b.x - a.x, b.z - a.z),
        ang = Math.atan2(b.z - a.z, b.x - a.x),
        g = new THREE.Group();

      for (let s = r0; s < d - r1; s += 0.8) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.07), dash);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = -ang;
        m.position.set(
          a.x + Math.cos(ang) * (s + 0.2),
          0.015,
          a.z + Math.sin(ang) * (s + 0.2),
        );
        g.add(m);
      }
      return g;
    };
    add(road(w.command, w.station, 4.6, 2.2), 0.05);
    const redMat = () =>
      new THREE.MeshBasicMaterial({
        color: T.red,
        transparent: true,
        opacity: 0.9,
      });
    for (const b of w.bases.filter((x) =>
      w.units.some((u) => u.atCommand && u.base === x.name),
    )) {
      const d = Math.hypot(b.pos.x, b.pos.z),
        ang = Math.atan2(b.pos.z, b.pos.x);
      for (let s2 = 4.6, i = 0; s2 < d - b.radius - 1.0; s2 += 0.8, i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.13), redMat());
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = -ang;
        m.position.set(
          Math.cos(ang) * (s2 + 0.2),
          0 + 0.02,
          Math.sin(ang) * (s2 + 0.2),
        );
        m.userData.march = s2;
        this.dynamic.add(m);
        this.marches.push(m);
      }
    }
    w.bases.forEach((b, k) => {
      const g = new THREE.Group();
      g.position.copy(v3(b.pos));
      g.userData.base = b;
      {
        const isl = new THREE.Mesh(
          new THREE.CircleGeometry(b.radius + 1.0, 48),
          new THREE.MeshBasicMaterial({
            map: islandTexture(T.island.fills[k % T.island.fills.length], k),
            transparent: true,
          }),
        );
        isl.rotation.x = -Math.PI / 2;
        isl.position.y = 0.01;
        g.add(isl);
      }
      {
        const drop = new THREE.Mesh(
          new THREE.CircleGeometry(b.radius + 1.0, 48),
          new THREE.MeshBasicMaterial({
            color: T.shadow.color,
            transparent: true,
            opacity: T.shadow.opacity * 0.9,
            depthWrite: false,
          }),
        );
        drop.rotation.x = -Math.PI / 2;
        drop.position.set(0.35, 0.005, 0.45);
        drop.scale.set(0.97, 0.97, 1);
        g.add(drop);
      }
      const lit = b.health.some(
        (h) =>
          h.state === "running" ||
          h.state === "scheduled" ||
          h.state === "waiting",
      );
      const hs = house(b, k, lit),
        away = Math.atan2(b.pos.z, b.pos.x);
      hs.position.set(
        Math.cos(away) * b.radius * 0.35,
        0,
        Math.sin(away) * b.radius * 0.35,
      );
      hs.rotation.set(0, -away - Math.PI / 2 + Math.PI, 0);
      g.add(hs);
      const crew = w.units.filter((u) => u.base === b.name),
        info = {
          asks: crew.filter((u) => u.atCommand).length,
          done: crew.reduce((n, u) => n + (u.agent.tasksDone || 0), 0),
          total: crew.reduce((n, u) => n + (u.agent.tasksTotal || 0), 0),
        };
      const card = this.tag("aw-card", "");
      card.innerHTML = `<b>${esc(b.name)}</b>${info.asks ? `<span class="aw-asks">${info.asks} waiting</span>` : ""}`;
      card.style.pointerEvents = "auto";
      card.onclick = () => {
        this.select(null);
        this.focus(b.pos, Math.max(this.fit * 1.6, 1));
        this.onPick({ kind: "base", base: b });
      };
      const back = b.pos.x + b.pos.z < 0,
        edge = (back ? -1 : 1) * Math.SQRT1_2 * (b.radius + 0.9),
        cardAt = new THREE.Vector3(
          b.pos.x + edge,
          back ? 0.4 : 0,
          b.pos.z + edge,
        );
      this.tags.push({
        el: card,
        at: () => cardAt,
        show: () => true,
        dy: back ? -4 : 2,
        rank: 1,
        below: !back,
      });
      add(road(w.command, b.pos, 4.6, b.radius + 1.0), 0.05 + k * 0.04);
      add(g, 0.15 + k * 0.08);
      this.bases.push({ base: b, card, group: g });
    });
    const R = Math.max(
      8,
      ...w.bases.map((b) => Math.hypot(b.pos.x, b.pos.z) + b.radius),
    );
    seedN = 11;
    for (let i = 0; i < 0; i++) {
      const a = (i / 11) * Math.PI * 2 + rnd() * 0.2,
        d = R + 2.5 + rnd() * 2,
        x = Math.cos(a) * d,
        z = Math.sin(a) * d;
      if (
        (x + z) / Math.SQRT2 > R * 0.45 ||
        (x + z) / Math.SQRT2 < -R * 0.55 ||
        w.bases.some(
          (b) => Math.hypot(x - b.pos.x, z - b.pos.z) < b.radius + 2.2,
        )
      )
        continue;
      const tr = sprite(treeTexture(i % 5), 2.0, 2.5, 4);
      tr.position.set(x, 0.55, z);
      add(tr, 0.4 + rnd() * 0.4);
    }
    w.units.forEach((u, i) => {
      const look = lookOf(u.agent, T.crayons),
        seed = i * 7 + 3,
        ask = u.atCommand,
        frames = [0, 1, 2].map((f) =>
          blobFrame(
            look,
            seed,
            f,
            ask,
            u.agent.state === "running",
            u.agent.role,
          ),
        );
      const W0 = ask
          ? w.alerts[0]?.agent.key === u.agent.key
            ? 3.6
            : 3.2
          : 2.9,
        s = sprite(frames[0], W0, W0 * (300 / 256));
      s.userData.w = W0;
      s.userData.unit = u;
      const home = w.bases.find((b) => b.name === u.base),
        was = this.prev.get(u.agent.key);
      const to = v3(u.pos);
      let from: THREE.Vector3 | null = null;
      if (!intro && was && was.pos.distanceTo(to) > 0.5) from = was.pos.clone();
      else if (!intro && !was && ask && home) from = v3(home.pos);
      const shadow = shadowDisc(0.9);
      this.dynamic.add(shadow);
      const mi = Math.max(
          0,
          w.machines.findIndex((m) => m.id === u.agent.machineId),
        ),
        ring = groundSprite(
          ringTexture(mi === 0 ? "solid" : mi === 1 ? "dash" : "dot"),
          W0 * 0.78,
          look.grey ? 0.35 : 0.75,
        );
      ring.position.y = 0.03;
      ring.visible = !ask;
      this.dynamic.add(ring);
      const pill = this.tag("aw-act", u.agent.action);
      const alert: HTMLElement | null = null;
      let loop: THREE.Sprite | null = null;
      if (u.agent.state === "scheduled") {
        loop = sprite(loopTexture(), 0.8, 0.8, 15);
        this.dynamic.add(loop);
      }
      if (ask) {
        const ping = groundSprite(ringTexture("red"), W0 * 0.8);
        ping.position.set(to.x, 0.035, to.z);
        this.dynamic.add(ping);
        this.pings.push(ping);
      }
      if (
        was &&
        ((was.state !== "recent" && u.agent.state === "recent") ||
          (was.atCommand && !ask))
      )
        this.burst(was.pos);
      const route = u.route ? u.route.map((p) => v3(p)) : null;
      s.position.copy(from ?? to).setY(s.scale.y / 2);
      this.dynamic.add(s);
      this.units.push({
        gy: 0,
        home: home ? { x: home.pos.x, z: home.pos.z, r: home.radius } : null,
        nudge: { x: 0, z: 0 },
        unit: u,
        sprite: s,
        frames,
        shadow,
        ring,
        pill,
        alert,
        loop,
        from,
        to,
        t0: now,
        phase: (i * 1.7) % 6,
        route,
        length: route ? route[0].distanceTo(route[1]) : 0,
        born: now + (intro ? 0.9 + i * 0.06 : 0),
        head: to.clone().setY(W0),
      });
      const live = this.units[this.units.length - 1],
        key = u.agent.key;
      this.tags.push({
        el: pill,
        at: () => new THREE.Vector3(live.head.x, 0, live.head.z),
        show: () =>
          t0ok(live) &&
          !u.atCommand &&
          (this.hovered === key ||
            this.selected === key ||
            ((u.agent.state === "running" || u.agent.state === "scheduled") &&
              Math.hypot(live.head.x, live.head.z) > 6.2)),
        dy: 8,
        rank: 3,
        below: true,
        foot: true,
      });
    });
    this.prev = new Map(
      this.units.map((l) => [
        l.unit.agent.key,
        {
          state: l.unit.agent.state,
          atCommand: l.unit.atCommand,
          pos: l.to.clone(),
        },
      ]),
    );
    this.measureFit();
    if (intro) {
      this.glide = {
        from: this.controls.focus.clone(),
        to: new THREE.Vector3(0.6, 0, 0.6),
        t: 0,
        z0: this.fit * 0.6,
        z1: this.fit,
      };
    }
    this.first = false;
    if (this.selected && !w.units.some((u) => u.agent.key === this.selected))
      this.select(null);
  }
  private tag(cls: string, text: string): HTMLElement {
    const el = document.createElement("div");
    el.className = `aw-tag ${cls}`;
    el.textContent = text;
    this.overlay.appendChild(el);
    return el;
  }
  private placeTags() {
    const w = this.el.clientWidth,
      h = this.el.clientHeight,
      taken: {
        l: number;
        t: number;
        r: number;
        b: number;
        rank: number;
      }[] = [];
    for (const tg of [...this.fixedTags, ...this.tags].sort(
      (a, b) => a.rank - b.rank,
    )) {
      if (!tg.show()) {
        if (tg.el.style.display !== "none") tg.el.style.display = "none";
        continue;
      }
      const p = tg.at().clone().project(this.camera);
      let y = ((1 - p.y) / 2) * h + tg.dy,
        x = ((p.x + 1) / 2) * w;
      tg.el.style.display = "";
      const ew = tg.el.offsetWidth,
        eh = tg.el.offsetHeight,
        pad = w < 760 ? 8 : 16;
      if (tg.rank === 1 || tg.rank === 2)
        x = Math.min(w - pad - ew / 2, Math.max(pad + ew / 2, x));
      if (
        (tg.rank === 1 || tg.rank === 2) &&
        w >= 760 &&
        (x - ew / 2 < 640 || x + ew / 2 > w - 330)
      ) {
        const top = tg.below ? y : y - eh;
        if (top < 108) y += 108 - top;
      }
      const box = {
        l: x - ew / 2,
        r: x + ew / 2,
        t: tg.below ? y : y - eh,
        b: tg.below ? y + eh : y,
      };
      const hits = (o: {
        l: number;
        t: number;
        r: number;
        b: number;
        rank: number;
      }) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t;
      if (
        w < 760 &&
        this.bottomInset &&
        (tg.rank === 1 || tg.rank === 2) &&
        box.b > h - this.bottomInset
      ) {
        tg.el.style.display = "none";
        continue;
      }
      if (
        (tg.rank >= 2 && taken.some(hits)) ||
        (tg.rank === 1 &&
          taken.some((o) => (o.rank === 0 || w < 760) && hits(o)))
      ) {
        tg.el.style.display = "none";
        continue;
      }
      taken.push({ ...box, rank: tg.rank });
      tg.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${tg.below ? "0" : "-100%"})`;
    }
  }
  private burst(at: THREE.Vector3) {
    const cols = [...Object.values(T.crayons).slice(0, 5), T.owner];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.08),
        new THREE.MeshBasicMaterial({
          color: cols[i % 6],
          side: THREE.DoubleSide,
        }),
      );
      m.position.copy(at).setY(1.6);
      this.scene.add(m);
      this.confetti.push({
        m,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          3 + Math.random() * 2.5,
          (Math.random() - 0.5) * 3,
        ),
        life: 1.6,
      });
    }
  }
  select(key: string | null, glide = true) {
    this.selected = key;
    const live = this.units.find((l) => l.unit.agent.key === key);
    this.selection.visible = !!live;
    if (live && glide) this.focus(live.to, Math.max(this.fit * 1.5, 1));
  }
  focus(p: THREE.Vector3 | Vec, zoom = this.controls.zoom) {
    const to = p instanceof THREE.Vector3 ? p.clone().setY(0) : v3(p);
    this.glide = {
      from: this.controls.focus.clone(),
      to,
      t: 0,
      z0: this.controls.zoom,
      z1: zoom,
    };
  }
  home() {
    this.focus({ x: 0.6, z: 0.6 }, this.fit);
  }
  setInset(px: number) {
    if (px === this.inset) return;
    this.inset = px;
    this.resize();
    if (this.world) {
      const before = this.fit;
      this.measureFit();
      if (this.fit !== before && !this.glide) this.home();
    }
  }
  private measureFit() {
    const w = this.world;
    if (!w) return;
    const cw = this.el.clientWidth || 1,
      ch = this.el.clientHeight || 1,
      half = 9.6;
    const sx = Math.max(
        6,
        ...w.bases.map(
          (b) => Math.abs(b.pos.x - b.pos.z) / Math.SQRT2 + b.radius + 5.2,
        ),
      ),
      sy = Math.max(
        5,
        ...w.bases.map(
          (b) =>
            (Math.abs(b.pos.x + b.pos.z) / Math.SQRT2) * 0.66 +
            b.radius * 0.66 +
            3.2,
        ),
      );
    const inset = cw > 900 ? this.inset : 0;
    this.fit = Math.max(
      0.12,
      Math.min(
        1.7,
        Math.min((half * ((cw - inset) / ch)) / sx, half / (sy + 0.6)) *
          (inset ? 1.19 : cw < 480 ? 1.25 : cw < 760 ? 0.95 : 1.09) *
          (cw < 760 ? 1 : (T.zoom ?? 1)),
      ),
    );
  }
  screenOf(key: string): {
    x: number;
    y: number;
  } | null {
    const l = this.units.find((u) => u.unit.agent.key === key);
    if (!l) return null;
    const r = this.renderer.domElement.getBoundingClientRect(),
      p = l.head.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height };
  }
  askerPointers(): Pointer[] {
    const r = this.renderer.domElement.getBoundingClientRect();
    return this.units
      .filter((l) => l.unit.atCommand)
      .map((l) => {
        const p = l.sprite.position.clone().project(this.camera);
        const x = ((p.x + 1) / 2) * r.width,
          y = ((1 - p.y) / 2) * r.height;
        return {
          key: l.unit.agent.key,
          x,
          y,
          onScreen: x > 40 && y > 70 && x < r.width - 40 && y < r.height - 40,
        };
      });
  }
  private hit(ev: MouseEvent): THREE.Object3D | null {
    const r = this.renderer.domElement.getBoundingClientRect(),
      ndc = new THREE.Vector2(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1,
      );
    this.ray.setFromCamera(ndc, this.camera);
    this.ray.camera = this.camera;
    for (const h of this.ray.intersectObjects(this.dynamic.children, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.unit && !o.userData.base) o = o.parent;
      if (o) return o;
    }
    return null;
  }
  private onMove = (ev: PointerEvent) => {
    const o = this.hit(ev),
      key = (o?.userData.unit as Unit | undefined)?.agent.key ?? null;
    this.renderer.domElement.style.cursor = o ? "pointer" : "grab";
    if (key !== this.hovered) {
      this.hovered = key;
      this.onHover(key);
    }
  };
  private onClick = (ev: MouseEvent) => {
    if (this.controls.wasDrag) return;
    const o = this.hit(ev);
    if (o?.userData.unit) {
      this.select((o.userData.unit as Unit).agent.key);
      this.onPick({ kind: "unit", unit: o.userData.unit });
    } else if (o?.userData.base) {
      this.select(null);
      this.focus((o.userData.base as Base).pos, Math.max(this.fit * 1.6, 1));
      this.onPick({ kind: "base", base: o.userData.base });
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
  private tick = () => {
    const nowMs = performance.now(),
      dt = Math.min(0.05, (nowMs - this.last) / 1000),
      t = nowMs / 1000;
    this.last = nowMs;
    if (this.glide) {
      const g = this.glide;
      g.t = Math.min(1, g.t + dt * (this.first ? 0.6 : 1.6));
      const e = g.t * g.t * (3 - 2 * g.t);
      this.controls.focus.copy(g.from).lerp(g.to, e);
      this.controls.zoom = g.z0 + (g.z1 - g.z0) * e;
      this.controls.apply();
      if (g.t >= 1) this.glide = null;
    } else if (nowMs - this.lastInput > 20000) {
      this.controls.focus.x += Math.sin(t * 0.07) * dt * 0.25;
      this.controls.focus.z += Math.cos(t * 0.05) * dt * 0.25;
      this.controls.apply();
    } else this.controls.update(dt);
    for (const p of this.pieces) {
      const k = Math.min(1, Math.max(0, (t - p.born) / 0.45));
      if (k < 1) {
        const e = k < 0.7 ? (k / 0.7) * 1.12 : 1.12 - ((k - 0.7) / 0.3) * 0.12;
        p.obj.scale.copy(p.scale).multiplyScalar(Math.max(0.0001, e));
      } else if (p.obj.scale.x !== p.scale.x) p.obj.scale.copy(p.scale);
    }
    const boil = Math.floor(t * 8) % 3,
      asking = this.units.some((l) => l.unit.atCommand);
    for (let i = 0; i < this.units.length; i++)
      for (let j = i + 1; j < this.units.length; j++) {
        const A = this.units[i],
          B = this.units[j],
          dx = B.head.x - A.head.x,
          dz = B.head.z - A.head.z,
          d = Math.hypot(dx, dz),
          min = 2.1;
        if (d < min && d > 0.0001) {
          const push = (min - d) / 2,
            ux = dx / d,
            uz = dz / d,
            a2 = A.unit.atCommand ? 0 : B.unit.atCommand ? 2 : 1,
            b2 = 2 - a2;
          A.nudge.x -= ux * push * a2 * 0.5;
          A.nudge.z -= uz * push * a2 * 0.5;
          B.nudge.x += ux * push * b2 * 0.5;
          B.nudge.z += uz * push * b2 * 0.5;
        } else if (d <= 0.0001 && !A.unit.atCommand) A.nudge.x -= 0.05;
      }
    for (const l of this.units) {
      const s = l.sprite,
        st = l.unit.agent.state;
      if (t < l.born) {
        s.visible = false;
        l.shadow.visible = l.ring.visible = false;

        continue;
      }
      s.visible = l.ring.visible = true;
      l.shadow.visible = true;
      (s.material as THREE.SpriteMaterial).map =
        l.frames[(boil + Math.floor(l.phase)) % 3];
      const pos = new THREE.Vector3();
      let walking = false;
      if (l.from) {
        const k = Math.min(1, (t - l.t0) / 3.2);
        pos.copy(l.from).lerp(l.to, k * k * (3 - 2 * k));
        walking = k < 1;
        if (!walking) l.from = null;
      } else if (l.route) {
        const q = (t * 0.07 + l.phase) % 2,
          p = alongPath(l.route, l.length, q < 1 ? q : 2 - q);
        pos.copy(p.pos);
        walking = true;
      } else pos.copy(l.to);
      if (!l.unit.atCommand && !walking && l.home) {
        const ox = pos.x + l.nudge.x - l.home.x,
          oz = pos.z + l.nudge.z - l.home.z,
          d = Math.hypot(ox, oz),
          max = Math.max(0.6, l.home.r - 0.4);
        if (d > max) {
          const k = max / d;
          l.nudge.x = l.home.x + ox * k - pos.x;
          l.nudge.z = l.home.z + oz * k - pos.z;
        }
      }
      if (!l.unit.atCommand) {
        l.nudge.x *= 0.996;
        l.nudge.z *= 0.996;
        l.nudge.x = Math.max(-2.5, Math.min(2.5, l.nudge.x));
        l.nudge.z = Math.max(-2.5, Math.min(2.5, l.nudge.z));
        pos.x += l.nudge.x;
        pos.z += l.nudge.z;
      }
      if (!l.unit.atCommand) {
        const dx = pos.x - POST.x,
          dz = pos.z - POST.z,
          d = Math.hypot(dx, dz);
        if (d < 3.2) {
          const k = 3.2 / Math.max(d, 0.01);
          pos.x = POST.x + dx * k;
          pos.z = POST.z + dz * k;
        }
        for (const a of this.units)
          if (a.unit.atCommand) {
            const ex = pos.x - a.to.x,
              ez = pos.z - a.to.z,
              e = Math.hypot(ex, ez),
              min = 2.6;
            if (e < min) {
              const k = min / Math.max(e, 0.01);
              pos.x = a.to.x + ex * k;
              pos.z = a.to.z + ez * k;
            }
          }
      }
      const w0 = s.userData.w as number,
        h0 = w0 * (300 / 256),
        pop = Math.min(1, (t - l.born) / 0.35);
      let lift = 0,
        sx = 1,
        sy = 1;
      if (walking) {
        lift = Math.abs(Math.sin(t * 9 + l.phase)) * 0.18;
      } else if (st === "waiting") {
        lift = Math.abs(Math.sin(t * 4.2 + l.phase)) * 0.3;
        sy = 1 + Math.sin(t * 8.4) * 0.03;
        if (this.world?.alerts[0]?.agent.key === l.unit.agent.key) {
          const k = t % 4;
          if (k < 0.5) {
            s.material.rotation = Math.sin(k * 25) * 0.12;
            lift = 0;
          } else s.material.rotation = 0;
        }
      } else if (st === "running") {
        const b = Math.sin(t * 4 * Math.PI + l.phase);
        lift = Math.max(0, b) * 0.1;
        sx = 1 - b * 0.04;
        sy = 1 + b * 0.05;
      } else if (st === "scheduled")
        s.material.rotation = Math.sin(t * 1.4 + l.phase) * 0.08;
      else if (st === "recent")
        lift = Math.max(0, Math.sin(t * 2 + l.phase) - 0.85) * 1.2;
      else if (st === "resting") {
        sx = sy = 1 + Math.sin(t * 1.6 + l.phase) * 0.02;
      }
      const gy = groundAt(pos.x, pos.z);
      l.gy += (gy - l.gy) * Math.min(1, dt * 10);
      s.scale.set(w0 * sx * pop, h0 * sy * pop, 1);
      s.position.set(pos.x, h0 / 2 + lift + l.gy, pos.z);

      (s.material as THREE.SpriteMaterial).opacity =
        asking && !l.unit.atCommand && this.selected !== l.unit.agent.key
          ? 0.82
          : 1;
      l.shadow.position.set(pos.x, l.gy + 0.02, pos.z);
      l.shadow.scale.setScalar(1 - lift * 0.8);
      l.ring.position.set(pos.x, l.gy + 0.03, pos.z);
      l.head.set(pos.x, h0 + lift + l.gy, pos.z);
      if (l.loop) {
        l.loop.position.set(pos.x, h0 + lift + 0.45, pos.z);
        l.loop.material.rotation = -t * 2.2;
        l.loop.visible = true;
      }
      if (this.selected === l.unit.agent.key)
        this.selection.position.set(pos.x, l.gy + 0.04, pos.z);
    }
    {
      const right = new THREE.Vector3().setFromMatrixColumn(
        this.camera.matrixWorld,
        0,
      );
      right.y = 0;
      right.normalize();
      const W = this.el.clientWidth || 1,
        H = this.el.clientHeight || 1;
      const scr = this.units.map((l) => {
        const p = l.head.clone().project(this.camera);
        return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H };
      });
      for (let i = 0; i < this.units.length; i++)
        for (let j = i + 1; j < this.units.length; j++) {
          const A = this.units[i],
            B = this.units[j];
          if (t < A.born || t < B.born) continue;
          const dx = scr[j].x - scr[i].x,
            dy = scr[j].y - scr[i].y;
          const near = A.unit.atCommand || B.unit.atCommand ? 66 : 38;
          if (
            Math.abs(dx) < near &&
            Math.abs(dy) < (A.unit.atCommand || B.unit.atCommand ? 84 : 64)
          ) {
            const dir = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx),
              step = A.unit.atCommand || B.unit.atCommand ? 0.16 : 0.06;
            if (!A.unit.atCommand) {
              A.nudge.x -= right.x * step * dir;
              A.nudge.z -= right.z * step * dir;
            }
            if (!B.unit.atCommand) {
              B.nudge.x += right.x * step * dir;
              B.nudge.z += right.z * step * dir;
            }
          }
        }
    }
    for (const m of this.marches)
      (m.material as THREE.MeshBasicMaterial).opacity =
        0.3 +
        0.7 *
          Math.max(0, Math.sin((m.userData.march as number) * 1.4 + t * 3.2));
    for (const p of this.pings) {
      const k = (t * 0.9) % 1;
      p.scale.setScalar(1 + k * 0.9);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k);
    }
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.v.y -= 6 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += dt * 8;
      c.m.rotation.y += dt * 5;
      c.life -= dt;
      if (c.life <= 0 || c.m.position.y < 0) {
        this.scene.remove(c.m);
        c.m.geometry.dispose();
        (c.m.material as THREE.Material).dispose();
        this.confetti.splice(i, 1);
      }
    }
    this.placeTags();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener("click", this.onClick);
    this.renderer.domElement.removeEventListener("pointermove", this.onMove);
    disposeTree(this.scene);
    for (const x of cache.values()) x.dispose();
    cache.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }
}
function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mm = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
    else mm?.dispose();
  });
}
export { STATE_LABEL };
