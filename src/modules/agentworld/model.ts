import type {
  AgentSheetData,
  SceneState,
  SheetAgent,
  SheetProject,
} from "@/modules/sheet/agents";
import type { Expression } from "./blob";
export type Vec = {
  x: number;
  z: number;
};
export const STATES: SceneState[] = [
  "waiting",
  "running",
  "scheduled",
  "recent",
  "resting",
  "offline",
];
export const STATE_COLOR: Record<SceneState, string> = {
  waiting: "#ef4444",
  running: "#f59e0b",
  scheduled: "#3b82f6",
  recent: "#22c55e",
  resting: "#94a3b8",
  offline: "#475569",
};
export const STATE_LABEL: Record<SceneState, string> = {
  waiting: "needs you",
  running: "working",
  scheduled: "looping",
  recent: "just done",
  resting: "resting",
  offline: "no signal",
};
export const LOOK: Record<
  SceneState,
  {
    face: Expression;
    crayon: string;
  }
> = {
  waiting: { face: "excited", crayon: "#f7c597" },
  running: { face: "smile", crayon: "#f8d98a" },
  scheduled: { face: "calm", crayon: "#cbb8ee" },
  recent: { face: "smile", crayon: "#bde3b0" },
  resting: { face: "sleep", crayon: "#b9dbf4" },
  offline: { face: "frown", crayon: "#e5e7eb" },
};
export const OWNER_CRAYON = "#f6bfd6";
export const ANGRY_AFTER_MINUTES = 30;
export function lookOf(
  a: Pick<SheetAgent, "state" | "minutes">,
  crayons?: Record<SceneState, string>,
): {
  face: Expression;
  crayon: string;
  grey: boolean;
} {
  const l = LOOK[a.state];
  return {
    face:
      a.state === "waiting" && a.minutes >= ANGRY_AFTER_MINUTES
        ? "angry"
        : l.face,
    crayon: crayons?.[a.state] ?? l.crayon,
    grey: a.state === "offline",
  };
}
export const MACHINE_COLORS = [
  "#4ade80",
  "#fb923c",
  "#38bdf8",
  "#f472b6",
  "#facc15",
];
export const TOOL_COLOR = { claude: "#d97757", codex: "#64748b" } as const;
export interface Base {
  name: string;
  pos: Vec;
  radius: number;
  worst: SceneState;
  health: {
    state: SceneState;
    n: number;
  }[];
  total: number;
  machines: string[];
  say: string;
  age: string;
}
export interface Unit {
  agent: SheetAgent;
  base: string;
  pos: Vec;
  route: Vec[] | null;
  ring: string;
  atCommand: boolean;
}
export interface World {
  command: Vec;
  station: Vec;
  bases: Base[];
  units: Unit[];
  machines: {
    id: string;
    name: string;
    stale: boolean;
    seen: string;
    color: string;
  }[];
  counts: Record<SceneState, number>;
  alerts: Unit[];
  totals: {
    agents: number;
    helpers: number;
    computers: number;
    active: number;
    tasksDone: number;
    tasksTotal: number;
    oldestWait: number | null;
  };
  sample: boolean;
}
const rank = (s: SceneState) => STATES.indexOf(s);
const ASK_SLOTS = [
  { a: 0, r: 4.3 },
  { a: -0.78, r: 4.6 },
  { a: 0.78, r: 4.6 },
  { a: -1.45, r: 5.2 },
  { a: 1.45, r: 5.2 },
];
const worstOf = (p: SheetProject): SceneState =>
  STATES.find((s) => p.states[s] > 0) ?? "resting";
const isRunner = (a: SheetAgent) =>
  (a.role === "runner" || a.role === "supervisor") &&
  (a.state === "running" || a.state === "scheduled" || a.state === "recent");
export function layoutWorld(
  d: AgentSheetData & {
    sample?: boolean;
  },
): World {
  const projects = [...d.projects].sort(
    (a, b) => rank(worstOf(a)) - rank(worstOf(b)) || b.total - a.total,
  );
  const n = Math.max(1, projects.length),
    R = n <= 5 ? 10 : n <= 8 ? 12 : n <= 10 ? 13.5 : 16,
    step = (Math.PI * 2) / n;
  const angleOf = (k: number) =>
    Math.PI / 4 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
  const onScreen = (a: number): Vec => {
    const u = Math.sin(a - Math.PI / 4) * R * 1.38,
      v = Math.cos(a - Math.PI / 4) * R * 0.92;
    return { x: (v - u) / Math.SQRT2, z: (v + u) / Math.SQRT2 };
  };
  const bases: Base[] = projects.map((p, k) => ({
    name: p.name,
    pos: onScreen(angleOf(k)),
    radius: p.total <= 2 ? 2.5 : p.total <= 6 ? 3.0 : 3.5,
    worst: worstOf(p),
    health: STATES.filter((s) => p.states[s] > 0).map((s) => ({
      state: s,
      n: p.states[s],
    })),
    total: p.total,
    machines: p.machines,
    say: p.say,
    age: p.age,
  }));
  const sa = (3 * Math.PI) / 4 + step / 2,
    command: Vec = { x: 0, z: 0 },
    station: Vec = (() => {
      const u = Math.sin(sa - Math.PI / 4) * 8.2,
        v = Math.cos(sa - Math.PI / 4) * 6.6;
      return { x: (v - u) / Math.SQRT2, z: (v + u) / Math.SQRT2 };
    })();
  const machineColor = new Map(
    d.machines.map((m, i) => [m.id, MACHINE_COLORS[i % MACHINE_COLORS.length]]),
  );
  const units: Unit[] = [];
  for (const b of bases) {
    const crew = d.agents
      .filter((a) => a.project === b.name)
      .sort((x, y) => rank(x.state) - rank(y.state));
    const toCenter = Math.atan2(command.z - b.pos.z, command.x - b.pos.x);
    let front = 0,
      back = 0;
    for (const a of crew) {
      const ring = machineColor.get(a.machineId) ?? MACHINE_COLORS[0];
      if (a.state === "waiting") {
        units.push({
          agent: a,
          base: b.name,
          pos: { x: 0, z: 0 },
          route: null,
          ring,
          atCommand: true,
        });
        continue;
      }
      if (a.state === "resting" || a.state === "offline") {
        const ang = toCenter + Math.PI + (back - 2) * 0.55;
        units.push({
          agent: a,
          base: b.name,
          pos: {
            x: b.pos.x + Math.cos(ang) * b.radius * 0.55,
            z: b.pos.z + Math.sin(ang) * b.radius * 0.55,
          },
          route: null,
          ring,
          atCommand: false,
        });
        back++;
        continue;
      }
      const ang = toCenter + (front % 2 ? 1 : -1) * Math.ceil(front / 2) * 0.62;
      const pos = {
        x: b.pos.x + Math.cos(ang) * b.radius * 0.9,
        z: b.pos.z + Math.sin(ang) * b.radius * 0.9,
      };
      units.push({
        agent: a,
        base: b.name,
        pos,
        route: isRunner(a)
          ? [pos, { x: station.x + 1.6, z: station.z + 1.6 }]
          : null,
        ring,
        atCommand: false,
      });
      front++;
    }
  }
  units
    .filter((u) => u.atCommand)
    .sort((x, y) => y.agent.minutes - x.agent.minutes)
    .forEach((u, i) => {
      const slot = ASK_SLOTS[i % ASK_SLOTS.length],
        ring = Math.floor(i / ASK_SLOTS.length);
      u.pos = {
        x: Math.cos(Math.PI / 4 + slot.a) * (slot.r + ring * 1.6),
        z: Math.sin(Math.PI / 4 + slot.a) * (slot.r + ring * 1.6),
      };
    });
  const counts = Object.fromEntries(
    STATES.map((s) => [s, d.agents.filter((a) => a.state === s).length]),
  ) as Record<SceneState, number>;
  return {
    command,
    station,
    bases,
    units,
    machines: d.machines.map((m) => ({
      id: m.id,
      name: m.name,
      stale: m.stale,
      seen: m.seen,
      color: machineColor.get(m.id) ?? MACHINE_COLORS[0],
    })),
    counts,
    alerts: units
      .filter((u) => u.atCommand)
      .sort((x, y) => y.agent.minutes - x.agent.minutes),
    totals: {
      agents: d.agents.length,
      helpers: d.agents.reduce((n, a) => n + (a.helpers || 0), 0),
      computers: d.machines.length,
      active: d.agents.filter(
        (a) => a.state === "running" || a.state === "scheduled",
      ).length,
      tasksDone: d.agents.reduce((n, a) => n + (a.tasksDone || 0), 0),
      tasksTotal: d.agents.reduce((n, a) => n + (a.tasksTotal || 0), 0),
      oldestWait: units.some((u) => u.atCommand)
        ? Math.max(
            ...units.filter((u) => u.atCommand).map((u) => u.agent.minutes),
          )
        : null,
    },
    sample: !!d.sample,
  };
}
export function demoMask(
  d: AgentSheetData,
  keep: ReadonlySet<string> = new Set(),
): AgentSheetData {
  const names = new Map(
    d.projects.map((p, i) => [
      p.name,
      keep.has(p.name)
        ? p.name
        : `Project ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`,
    ]),
  );
  const macs = new Map(d.machines.map((m, i) => [m.name, `Mac ${i + 1}`]));
  const ROLE_TITLE: Record<string, string> = {
    runner: "Board runner",
    supervisor: "Supervisor",
    reviewer: "Reviewer",
    writer: "Writer",
    builder: "Builder",
  };
  const ask = (s: string) =>
    /review|approve|ok to|ship|deploy|release/i.test(s)
      ? "Asks you to approve a release"
      : /decide|choose|which|should/i.test(s)
        ? "Asks you to make a decision"
        : /sign in|log ?in|password|key/i.test(s)
          ? "Asks you to sign in"
          : "Asks you a question";
  return {
    machines: d.machines.map((m) => ({
      ...m,
      name: macs.get(m.name) ?? "Mac",
    })),
    projects: d.projects.map((p) => ({
      ...p,
      name: names.get(p.name) ?? "Project",
      machines: p.machines.map((x) => macs.get(x) ?? "Mac"),
      say: "",
    })),
    agents: d.agents.map((a) =>
      keep.has(a.project)
        ? {
            ...a,
            machine: macs.get(a.machine) ?? "Mac",
            title: ROLE_TITLE[a.role] ?? "Agent",
          }
        : {
            ...a,
            project: names.get(a.project) ?? "Project",
            machine: macs.get(a.machine) ?? "Mac",
            title: ROLE_TITLE[a.role] ?? "Agent",
            say: a.state === "waiting" ? ask(a.say) : a.action,
            href: "",
          },
    ),
  };
}
