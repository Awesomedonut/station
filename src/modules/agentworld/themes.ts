import type { SceneState } from "@/modules/sheet/agents";
import type { BlobInk } from "./blob";
export type ThemeId = "donut" | "donuttray";
export interface Theme {
  id: ThemeId;
  group: "Blobs";
  name: string;
  note: string;
  blob: BlobInk;
  crayons: Record<SceneState, string>;
  owner: string;
  ground: { paper: string; grain: [string, string] };
  island: {
    fills: string[];
    plaza: string;
    hatch: string;
    speck: [string, string];
    edge: string;
  };
  house: {
    walls: number;
    roofs: number[];
    door: number;
    lit: number;
    dark: number;
    edge: number;
  };
  trees: { fills: string[]; line: string };
  light: { sky: number; ground: number; hemi: number; sun: number };
  road: { color: number; opacity: number };
  red: string;
  loop: string;
  shadow: { color: number; opacity: number };
  hud: Record<string, string>;
  font: string;
  zoom?: number;
  tray?: "crayon";
}
const BASE_HUD = {
  "--aw-red": "#d9452f",
  "--aw-red-bg": "#fde3dd",
  "--aw-red-fg": "#b42318",
  "--aw-red-bg2": "#fff1ee",
  "--aw-ok-bg": "#e3f1d8",
  "--aw-ok-fg": "#2f6b2a",
  "--aw-live": "#5fae5a",
  "--aw-bar": "#7fb56f",
  "--aw-bar-bg": "#e8e0cf",
};
export const THEMES: Record<ThemeId, Theme> = {
  donut: {
    id: "donut",
    group: "Blobs",
    name: "Donut",
    note: "Crayon on warm paper",
    blob: {
      style: "crayon",
      outline: "#4a4a4a",
      face: "#4a4a4a",
      nose: "#fffdf8",
      grain: true,
      wobble: 1,
      ghost: "rgba(255,253,248,.9)",
    },
    crayons: {
      waiting: "#f7c597",
      running: "#f8d98a",
      scheduled: "#cbb8ee",
      recent: "#bde3b0",
      resting: "#b9dbf4",
      offline: "#e5e7eb",
    },
    owner: "#f6bfd6",
    ground: {
      paper: "#f4ecde",
      grain: ["rgba(120,100,70,.06)", "rgba(255,255,255,.35)"],
    },
    island: {
      fills: ["#fbf6ea", "#faf4e6", "#fcf7ec", "#f9f3e4"],
      plaza: "#efe8da",
      hatch: "rgba(120,96,60,.16)",
      speck: ["rgba(255,255,255,.28)", "rgba(90,70,40,.07)"],
      edge: "#3a3a3a",
    },
    house: {
      walls: 0xf7f1e3,
      roofs: [0xe6e0d4, 0xdcd6ca, 0xe9e3d8, 0xd8d2c6],
      door: 0x8a7560,
      lit: 0xffe9a8,
      dark: 0xc9c4ba,
      edge: 0x1f1f1f,
    },
    trees: { fills: ["#e3e8da", "#dde3d3", "#e8ecdf"], line: "#3a3a3a" },
    light: { sky: 0xffffff, ground: 0xe8dcc4, hemi: 2.2, sun: 1.0 },
    road: { color: 0x3a3a3a, opacity: 0.55 },
    red: "#d9452f",
    loop: "#6f5bb0",
    shadow: { color: 0x3a3a3a, opacity: 0.16 },
    hud: {
      ...BASE_HUD,
      "--aw-bg": "#f4ecde",
      "--aw-card": "#fbf7ef",
      "--aw-card-hi": "#ffffff",
      "--aw-ink": "#2f2a26",
      "--aw-line": "#3a3a3a",
      "--aw-muted": "#6b6259",
      "--aw-faint": "#8a8076",
      "--aw-text2": "#4a433c",
      "--aw-hover": "#f0e8d8",
      "--aw-shadow": "rgba(58,58,58,.16)",
      "--aw-radius": "8px",
      "--aw-bw": "1px",
      "--aw-card-shadow": "3px 3px 0 rgba(58,58,58,.16)",
    },
    font: 'var(--font-kalam), "Chalkboard SE", system-ui, sans-serif',
  },
  donuttray: {
    id: "donuttray",
    group: "Blobs",
    name: "Marble + Donut",
    note: "Crayon blobs roll between tiles",
    blob: {
      style: "crayon",
      outline: "#4a4a4a",
      face: "#4a4a4a",
      nose: "#fffdf8",
      grain: true,
      wobble: 1,
      ghost: "rgba(255,253,248,.9)",
    },
    crayons: {
      waiting: "#f7b3a0",
      running: "#f8d98a",
      scheduled: "#cbb8ee",
      recent: "#bde3b0",
      resting: "#b9dbf4",
      offline: "#dedad2",
    },
    owner: "#f6bfd6",
    ground: {
      paper: "#f4ecde",
      grain: ["rgba(120,100,70,.06)", "rgba(255,255,255,.35)"],
    },
    island: {
      fills: ["#fbf6ea"],
      plaza: "#efe8da",
      hatch: "rgba(120,96,60,.16)",
      speck: ["rgba(255,255,255,.28)", "rgba(90,70,40,.07)"],
      edge: "#3a3a3a",
    },
    house: {
      walls: 0xf7f1e3,
      roofs: [0xe6e0d4],
      door: 0x8a7560,
      lit: 0xffe9a8,
      dark: 0xc9c4ba,
      edge: 0x1f1f1f,
    },
    trees: { fills: ["#e3e8da"], line: "#3a3a3a" },
    light: { sky: 0xffffff, ground: 0xe8dcc4, hemi: 2.2, sun: 1.0 },
    road: { color: 0x3a3a3a, opacity: 0 },
    red: "#d9452f",
    loop: "#6f5bb0",
    shadow: { color: 0x3a3a3a, opacity: 0.16 },
    hud: {
      ...BASE_HUD,
      "--aw-bg": "#f4ecde",
      "--aw-card": "#fbf7ef",
      "--aw-card-hi": "#ffffff",
      "--aw-ink": "#2f2a26",
      "--aw-line": "#3a3a3a",
      "--aw-muted": "#6b6259",
      "--aw-faint": "#8a8076",
      "--aw-text2": "#4a433c",
      "--aw-hover": "#f0e8d8",
      "--aw-shadow": "rgba(58,58,58,.16)",
      "--aw-radius": "8px",
      "--aw-bw": "1px",
      "--aw-card-shadow": "3px 3px 0 rgba(58,58,58,.16)",
    },
    font: 'var(--font-kalam), "Chalkboard SE", system-ui, sans-serif',
    tray: "crayon",
  },
};
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = "donut";
export const isThemeId = (id: unknown): id is ThemeId =>
  typeof id === "string" && Object.prototype.hasOwnProperty.call(THEMES, id);
export const themeOf = (id: unknown): Theme =>
  THEMES[isThemeId(id) ? id : DEFAULT_THEME];
