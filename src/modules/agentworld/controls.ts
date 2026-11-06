import * as THREE from "three";
export function alongPath(
  path: THREE.Vector3[],
  length: number,
  t: number,
): {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
} {
  let left = Math.max(0, Math.min(1, t)) * length;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i + 1].clone().sub(path[i]);
    const l = seg.length();
    if (left <= l || i === path.length - 2) {
      const dir = seg.normalize();
      return {
        pos: path[i].clone().add(dir.clone().multiplyScalar(Math.min(left, l))),
        dir,
      };
    }
    left -= l;
  }
  return { pos: path[0].clone(), dir: new THREE.Vector3(0, 0, 1) };
}
export class RtsControls {
  focus = new THREE.Vector3();
  zoom = 1;
  readonly offset = new THREE.Vector3(30, 40, 34);
  wasDrag = false;
  private dragStart: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private limit = 38;
  constructor(
    private camera: THREE.OrthographicCamera,
    private el: HTMLElement,
  ) {
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    window.addEventListener("blur", this.onBlur);
  }
  groundPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const r = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, p) ? p : null;
  }
  private onDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    this.dragStart = this.groundPoint(ev.clientX, ev.clientY);
    this.wasDrag = false;
  };
  private onMove = (ev: PointerEvent) => {
    if (!this.dragStart || !(ev.buttons & 1)) return;
    const now = this.groundPoint(ev.clientX, ev.clientY);
    if (!now) return;
    const d = this.dragStart.clone().sub(now);
    if (d.length() > 0.15) this.wasDrag = true;
    this.focus.add(d);
    this.clamp();
    this.apply();
  };
  private onUp = () => {
    this.dragStart = null;
  };
  private onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    this.zoom = Math.max(
      0.55,
      Math.min(1.85, this.zoom * (1 - ev.deltaY * 0.0012)),
    );
    this.apply();
  };
  private onBlur = () => {
    this.keys.clear();
    this.dragStart = null;
  };
  private onKey = (ev: KeyboardEvent) => {
    if ((ev.target as HTMLElement)?.closest("input,textarea,[contenteditable]"))
      return;
    if (!ev.key.startsWith("Arrow")) return;
    ev.preventDefault();
    if (ev.type === "keydown") this.keys.add(ev.key);
    else this.keys.delete(ev.key);
  };
  private clamp() {
    this.focus.x = Math.max(-this.limit, Math.min(this.limit, this.focus.x));
    this.focus.z = Math.max(-this.limit, Math.min(this.limit, this.focus.z));
    this.focus.y = 0;
  }
  apply() {
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }
  update(dt: number) {
    const step = (18 / this.zoom) * dt;
    if (this.keys.has("ArrowLeft"))
      this.focus.add(new THREE.Vector3(-0.7, 0, 0.7).multiplyScalar(step));
    if (this.keys.has("ArrowRight"))
      this.focus.add(new THREE.Vector3(0.7, 0, -0.7).multiplyScalar(step));
    if (this.keys.has("ArrowUp"))
      this.focus.add(new THREE.Vector3(-0.7, 0, -0.7).multiplyScalar(step));
    if (this.keys.has("ArrowDown"))
      this.focus.add(new THREE.Vector3(0.7, 0, 0.7).multiplyScalar(step));
    this.clamp();
    this.apply();
  }
  viewRect(
    aspect: number,
    halfHeight: number,
  ): {
    x: number;
    z: number;
    w: number;
    h: number;
  } {
    const h = (halfHeight * 2) / this.zoom;
    return {
      x: this.focus.x,
      z: this.focus.z,
      w: h * aspect * 0.75,
      h: h * 0.9,
    };
  }
  dispose() {
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointermove", this.onMove);
    this.el.removeEventListener("pointerup", this.onUp);
    this.el.removeEventListener("pointercancel", this.onUp);
    this.el.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("blur", this.onBlur);
  }
}
