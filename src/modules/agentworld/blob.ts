export type Expression =
  "smile" | "frown" | "angry" | "excited" | "calm" | "sleep";
export const EXPRESSIONS: Expression[] = [
  "smile",
  "frown",
  "angry",
  "excited",
  "calm",
  "sleep",
];
export const BLOB_COLORS = [
  "#f8d98a",
  "#b9dbf4",
  "#f6bfd6",
  "#bde3b0",
  "#cbb8ee",
  "#f7c597",
] as const;
export interface BlobInk {
  style: "crayon";
  outline: string;
  face: string;
  nose: string;
  grain: boolean;
  wobble: number;
  ghost: string;
}
export const CRAYON_INK: BlobInk = {
  style: "crayon",
  outline: "#4a4a4a",
  face: "#4a4a4a",
  nose: "#fffdf8",
  grain: true,
  wobble: 1,
  ghost: "rgba(255,253,248,.9)",
};
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function shaky(
  c: CanvasRenderingContext2D,
  pts: [number, number][],
  r: () => number,
  wob: number,
) {
  c.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = (r() - 0.5) * wob,
      jy = (r() - 0.5) * wob;
    if (i === 0) c.moveTo(x + jx, y + jy);
    else c.lineTo(x + jx, y + jy);
  });
  c.stroke();
}
const arc = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  n = 12,
): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
type BlobOpts = {
  seed?: number;
  phase?: number;
  grey?: boolean;
  laptop?: boolean;
  ink?: BlobInk;
  role?: string;
  preview?: boolean;
};
export function drawBlob(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  expr: Expression,
  opts: BlobOpts = {},
) {
  const ink = opts.ink ?? CRAYON_INK;
  drawLine(c, cx, cy, size, color, expr, opts, ink);
}
function drawLine(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  expr: Expression,
  { seed = 1, phase = 0, grey = false, laptop = false }: BlobOpts,
  ink: BlobInk,
  minLine = 1.4,
) {
  const INK = ink.face,
    LINE = ink.outline,
    W = ink.wobble;
  const r = rng(seed * 7919 + 13),
    rx = size * 0.4,
    ry = size * 0.5,
    lw = Math.max(minLine, size * 0.03),
    tilt = (r() - 0.5) * 0.12 * Math.min(1, W);
  const fill = grey ? "#cbd5e1" : color,
    k = Math.sin(phase * Math.PI * 2);
  const shake = (pts: [number, number][], wob: number) =>
    shaky(c, pts, r, wob * W);
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = LINE;
  c.lineWidth = lw;
  const legY = cy + ry * 0.82;
  for (const s of [-1, 1])
    shake(
      [
        [cx + s * rx * 0.3, legY],
        [cx + s * rx * (0.5 + 0.1 * k * s), legY + size * 0.27],
      ],
      lw * 0.3,
    );
  const armY = cy + ry * 0.05;
  for (const s of [-1, 1]) {
    if (expr === "excited")
      shake(
        [
          [cx + s * rx * 0.85, cy - ry * 0.35],
          [cx + s * rx * (1.45 + 0.05 * k), cy - ry * (1.05 + 0.08 * k * s)],
        ],
        lw * 0.4,
      );
    else if (!laptop)
      shake(
        [
          [cx + s * rx * 0.92, armY],
          [cx + s * rx * 1.42, armY + size * 0.02 * k * s],
        ],
        lw * 0.4,
      );
  }
  const body = (wob: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2,
        e = 1 + 0.02 * Math.sin(a * 3 + seed),
        x = Math.cos(a) * rx * e,
        y = Math.sin(a) * ry * e * (Math.sin(a) > 0 ? 0.98 : 1.02);
      pts.push([
        cx + x * Math.cos(tilt) - y * Math.sin(tilt) + (r() - 0.5) * wob,
        cy + x * Math.sin(tilt) + y * Math.cos(tilt) + (r() - 0.5) * wob,
      ]);
    }
    return pts;
  };
  const outline = body(0);
  c.beginPath();
  outline.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();

  c.fillStyle = grey ? ink.ghost : fill;
  c.fill();
  if (ink.grain) {
    c.save();
    c.clip();
    c.lineWidth = Math.max(0.6, size * 0.008);
    for (let i = 0; i < size * 1.6; i++) {
      const x = cx + (r() - 0.5) * rx * 2.2,
        y = cy + (r() - 0.5) * ry * 2.2,
        a = r() * Math.PI,
        l = size * (0.02 + r() * 0.05);
      c.strokeStyle = r() < 0.5 ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.06)";
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
    c.restore();
  }
  c.lineWidth = lw;
  c.strokeStyle = LINE;

  for (let pass = 0; pass < 2; pass++)
    shake([...body(lw * 0.25), body(0)[0]], lw * 0.2);
  c.shadowBlur = 0;
  c.strokeStyle = INK;
  const ex = rx * 0.32,
    ey = cy - ry * 0.38,
    eh = size * 0.1;
  c.lineWidth = lw * 0.9;
  if (expr === "calm" || expr === "sleep")
    for (const s of [-1, 1])
      shake(
        arc(
          cx + s * ex,
          ey + eh * 0.2,
          rx * 0.16,
          eh * 0.35,
          0.15 * Math.PI,
          0.85 * Math.PI,
          8,
        ),
        lw * 0.2,
      );
  else
    for (const s of [-1, 1])
      shake(
        [
          [cx + s * ex, ey - eh / 2],
          [cx + s * ex + (r() - 0.5) * 2, ey + eh / 2],
        ],
        lw * 0.2,
      );
  if (expr === "angry")
    for (const s of [-1, 1])
      shake(
        [
          [cx + s * ex * 1.7, ey - eh * 1.05],
          [cx + s * ex * 0.55, ey - eh * 0.45],
        ],
        lw * 0.2,
      );
  const ny = cy - ry * 0.02;
  c.beginPath();
  c.ellipse(cx, ny, rx * 0.13, ry * 0.13, 0, 0, Math.PI * 2);
  c.fillStyle = ink.nose;
  c.fill();
  c.lineWidth = lw * 0.8;
  c.stroke();
  const my = cy + ry * 0.42;
  c.lineWidth = lw * 0.9;
  if (expr === "smile")
    shake(
      arc(
        cx,
        my - ry * 0.12,
        rx * 0.36,
        ry * 0.18,
        0.12 * Math.PI,
        0.88 * Math.PI,
      ),
      lw * 0.2,
    );
  else if (expr === "frown" || expr === "angry")
    shake(
      arc(
        cx,
        my + ry * 0.12,
        rx * 0.22,
        ry * 0.15,
        1.15 * Math.PI,
        1.85 * Math.PI,
      ),
      lw * 0.2,
    );
  else if (expr === "excited") {
    const w = rx * 0.22,
      h = ry * 0.3;
    c.beginPath();
    c.moveTo(cx - w, my - h * 0.4);
    c.lineTo(cx + w, my - h * 0.4);
    c.quadraticCurveTo(cx + w, my + h * 0.9, cx, my + h * 0.9);
    c.quadraticCurveTo(cx - w, my + h * 0.9, cx - w, my - h * 0.4);
    c.fillStyle = ink.nose;
    c.fill();
    c.stroke();
  } else
    shake(
      [
        [cx - rx * 0.1, my - ry * 0.04],
        [cx, my + ry * 0.06],
        [cx + rx * 0.1, my - ry * 0.04],
      ],
      lw * 0.15,
    );
  if (laptop) {
    const lx = cx,
      ly = cy + ry * 0.78,
      lwid = rx * 0.95,
      lh = ry * 0.34;
    c.lineWidth = lw * 0.9;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(lx - lwid / 2, ly);
    c.lineTo(lx + lwid / 2, ly);
    c.lineTo(lx + lwid / 2 - lwid * 0.1, ly - lh);
    c.lineTo(lx - lwid / 2 + lwid * 0.1, ly - lh);
    c.closePath();
    c.fillStyle = "#fff6cf";
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(lx - lwid * 0.62, ly + lh * 0.28);
    c.lineTo(lx + lwid * 0.62, ly + lh * 0.28);
    c.lineTo(lx + lwid / 2, ly);
    c.lineTo(lx - lwid / 2, ly);
    c.closePath();
    c.fillStyle = "#d9d4ca";
    c.fill();
    c.stroke();
    for (const s of [-1, 1])
      shake(
        [
          [cx + s * rx * 0.92, cy + ry * 0.1],
          [cx + s * lwid * 0.42, ly - lh * 0.1],
        ],
        lw * 0.3,
      );
  }
  if (expr === "sleep") {
    c.fillStyle = LINE;
    c.font = `600 ${Math.round(size * 0.16)}px "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif`;
    const zx = cx + rx * 0.7,
      zy = cy - ry * 1.02,
      up = phase * size * 0.05;
    c.fillText("z", zx, zy + size * 0.06 - up);
    c.fillText("z", zx + size * 0.11, zy - up);
    c.fillText("z", zx + size * 0.22, zy - size * 0.07 - up);
  }
  c.restore();
}
export function colorIndex(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % BLOB_COLORS.length;
}
