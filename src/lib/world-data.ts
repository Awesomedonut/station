import { readFile } from "node:fs/promises";
import { safeHref } from "./links";
import sample from "../../examples/world.json";
import type { SheetData } from "@/modules/sheet/shared";

export function parseWorldData(value: unknown): SheetData {
  const obj = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new Error("Expected an object");
    return v as Record<string, unknown>;
  };
  const list = (v: unknown): unknown[] => {
    if (!Array.isArray(v)) throw new Error("Expected an array");
    return v;
  };
  const fields = (v: unknown, spec: Record<string, string>) => {
    const o = obj(v);
    for (const [key, type] of Object.entries(spec)) {
      if (
        typeof o[key] !== type ||
        (type === "number" && (!Number.isFinite(o[key]) || Number(o[key]) < 0))
      )
        throw new Error(`Invalid field: ${key}`);
    }
    return o;
  };
  const choice = (v: unknown, options: string[]) => {
    if (typeof v !== "string" || !options.includes(v))
      throw new Error("Invalid state or role");
  };
  const statuses = ["waiting", "running", "scheduled", "idle"];
  const states = [
    "waiting",
    "running",
    "scheduled",
    "recent",
    "resting",
    "offline",
  ];
  const d = fields(value, { agent: "string", asOf: "string" });
  const data = obj(d.agents);
  const machines = new Set<string>();
  for (const m of list(data.machines)) {
    const o = fields(m, {
      id: "string",
      name: "string",
      stale: "boolean",
      seen: "string",
      quiet: "number",
    });
    if (machines.has(String(o.id))) throw new Error("Duplicate machine");
    machines.add(String(o.id));
  }
  const projects = new Set<string>();
  for (const p of list(data.projects)) {
    const o = fields(p, {
      name: "string",
      total: "number",
      notable: "boolean",
      age: "string",
      say: "string",
    });
    choice(o.status, statuses);
    fields(o.states, Object.fromEntries(states.map((s) => [s, "number"])));
    fields(o.counts, Object.fromEntries(statuses.map((s) => [s, "number"])));
    for (const m of list(o.machines))
      if (typeof m !== "string") throw new Error("Invalid machine name");
    if (projects.has(String(o.name))) throw new Error("Duplicate project");
    projects.add(String(o.name));
  }
  const keys = new Set<string>();
  for (const a of list(data.agents)) {
    const o = fields(
      a,
      Object.fromEntries([
        ...[
          "key",
          "machineId",
          "machine",
          "project",
          "action",
          "title",
          "say",
          "age",
          "tasks",
          "href",
        ].map((k) => [k, "string"]),
        ...["minutes", "helpers", "tasksDone", "tasksTotal"].map((k) => [
          k,
          "number",
        ]),
        ...["important", "stale", "station"].map((k) => [k, "boolean"]),
      ]),
    );
    choice(o.state, states);
    choice(o.status, statuses);
    choice(o.role, ["runner", "supervisor", "reviewer", "writer", "builder"]);
    choice(o.source, ["claude", "codex"]);
    if (
      keys.has(String(o.key)) ||
      !machines.has(String(o.machineId)) ||
      !projects.has(String(o.project))
    )
      throw new Error("Invalid agent reference");
    if (o.href && !safeHref(String(o.href)))
      throw new Error("Invalid agent link");
    keys.add(String(o.key));
  }
  for (const t of list(d.tickets)) {
    const o = fields(t, {
      project: "string",
      title: "string",
      note: "string",
      href: "string",
    });
    choice(o.state, ["yours", "agent", "other", "waiting", "done"]);
    if (o.href && !safeHref(String(o.href)))
      throw new Error("Invalid ticket link");
  }
  for (const t of list(d.done)) fields(t, { title: "string" });
  return value as SheetData;
}

export async function loadWorldData(
  file = process.env.STATION_DATA_FILE,
): Promise<SheetData> {
  if (!file) return { ...parseWorldData(sample), sample: true };
  return {
    ...parseWorldData(JSON.parse(await readFile(file, "utf8"))),
    sample: false,
  };
}
