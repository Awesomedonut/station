import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

const reporterDir = resolve(
  process.env.FORGE_REPORTER_DIR ?? "../forge-board/reporter",
);
const outputFile = resolve(
  process.env.STATION_DATA_FILE ?? `${tmpdir()}/station-world.json`,
);
const interval = Math.max(
  5000,
  Number(process.env.STATION_REFRESH_MS ?? 20000),
);

function ageLabel(minutes) {
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr`;
  return `${Math.floor(minutes / 1440)} days`;
}

function stateFor(agent, minutes) {
  if (agent.status === "waiting") return "waiting";
  if (agent.status === "running") return "running";
  if (agent.status === "scheduled") return "scheduled";
  if (minutes <= 10) return "recent";
  if (minutes <= 60) return "resting";
  return "offline";
}

function makeWorld(report) {
  const generatedAt = new Date(report.generatedAt);
  const now = Date.now();
  const machine = report.machine;
  const agents = report.agents.map((agent) => {
    const activity = Date.parse(agent.lastActivity ?? report.generatedAt);
    const minutes = Math.max(
      0,
      Math.floor((now - (Number.isFinite(activity) ? activity : now)) / 60000),
    );
    const state = stateFor(agent, minutes);
    const source = agent.source === "claude" ? "Claude Code" : "Codex";
    return {
      key: `${agent.key}@${machine.id}`,
      machineId: machine.id,
      machine: machine.name,
      project: agent.project || "Unsorted",
      status: agent.status,
      state,
      role: "builder",
      action: {
        waiting: "asks you",
        running: "working",
        scheduled: "looping",
        idle:
          state === "recent"
            ? "just finished"
            : state === "offline"
              ? "no signal"
              : "resting",
      }[agent.status],
      important: agent.status === "waiting" || agent.status === "running",
      title: `${source} session · ${agent.project || "Unsorted"}`,
      say: `${source} session · ${agent.status}`,
      age: ageLabel(minutes),
      minutes,
      helpers: agent.helpersActive ?? 0,
      tasks: `${agent.tasksDone ?? 0}/${agent.tasksTotal ?? 0} tasks`,
      tasksDone: agent.tasksDone ?? 0,
      tasksTotal: agent.tasksTotal ?? 0,
      source: agent.source,
      stale: false,
      station: false,
      href: "",
    };
  });
  const projectNames = [...new Set(agents.map((agent) => agent.project))];
  const projects = projectNames.map((name) => {
    const members = agents.filter((agent) => agent.project === name);
    const counts = {
      waiting: members.filter((agent) => agent.status === "waiting").length,
      running: members.filter((agent) => agent.status === "running").length,
      scheduled: members.filter((agent) => agent.status === "scheduled").length,
      idle: members.filter((agent) => agent.status === "idle").length,
    };
    const states = Object.fromEntries(
      ["waiting", "running", "scheduled", "recent", "resting", "offline"].map(
        (state) => [
          state,
          members.filter((agent) => agent.state === state).length,
        ],
      ),
    );
    const status = counts.waiting
      ? "waiting"
      : counts.running
        ? "running"
        : counts.scheduled
          ? "scheduled"
          : "idle";
    const minutes = Math.min(...members.map((agent) => agent.minutes));
    return {
      name,
      status,
      counts,
      states,
      total: members.length,
      machines: [machine.name],
      notable: counts.waiting > 0 || counts.running > 0,
      age: ageLabel(minutes),
      say: `${members.length} local session${members.length === 1 ? "" : "s"}`,
    };
  });
  return {
    agent: "Station",
    asOf: generatedAt.toISOString(),
    sample: false,
    tickets: [],
    done: [],
    agents: {
      machines: [
        {
          id: machine.id,
          name: machine.name,
          stale: false,
          seen: generatedAt.toISOString(),
          quiet: 0,
        },
      ],
      projects,
      agents,
    },
  };
}

function refresh() {
  const result = spawnSync(
    "uv",
    [
      "run",
      "--directory",
      reporterDir,
      "python",
      "-m",
      "agent_status.report",
      "--once",
      "--dry-run",
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || `Reporter exited with ${result.status}`,
    );
  }
  const world = makeWorld(JSON.parse(result.stdout));
  mkdirSync(dirname(outputFile), { recursive: true });
  const temporaryFile = `${outputFile}.${process.pid}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(world));
  renameSync(temporaryFile, outputFile);
  console.log(
    `${new Date().toLocaleTimeString()} updated ${world.agents.agents.length} local sessions across ${world.agents.projects.length} projects`,
  );
}

function wait() {
  return new Promise((resolveWait) => setTimeout(resolveWait, interval));
}

while (true) {
  try {
    refresh();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
  await wait();
}
