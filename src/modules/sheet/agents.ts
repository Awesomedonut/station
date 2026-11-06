export type AgentStatus = "waiting" | "running" | "scheduled" | "idle";
export type AgentRole =
  "runner" | "supervisor" | "reviewer" | "writer" | "builder";
export type SceneState =
  "waiting" | "running" | "scheduled" | "recent" | "resting" | "offline";
export type SheetAgent = {
  key: string;
  machineId: string;
  machine: string;
  project: string;
  status: AgentStatus;
  state: SceneState;
  role: AgentRole;
  action: string;
  important: boolean;
  title: string;
  say: string;
  age: string;
  minutes: number;
  helpers: number;
  tasks: string;
  tasksDone: number;
  tasksTotal: number;
  source: "claude" | "codex";
  stale: boolean;
  station: boolean;
  href: string;
};
export type SheetProject = {
  name: string;
  status: AgentStatus;
  counts: Record<AgentStatus, number>;
  states: Record<SceneState, number>;
  total: number;
  machines: string[];
  notable: boolean;
  age: string;
  say: string;
};
export type SheetMachine = {
  id: string;
  name: string;
  stale: boolean;
  seen: string;
  quiet: number;
};
export type AgentSheetData = {
  machines: SheetMachine[];
  projects: SheetProject[];
  agents: SheetAgent[];
};
