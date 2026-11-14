import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from "node:fs";
import { homedir, hostname, platform } from "node:os";
import { basename, dirname, join } from "node:path";

const TAIL_BYTES = 256 * 1024;
const HEAD_BYTES = 1024 * 1024;
const RUNNING_MS = 3 * 60 * 1000;
const WAITING_MS = 30 * 60 * 1000;
const HELPER_MS = 2 * 60 * 1000;

function readRange(file, start, length) {
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(length);
    const read = readSync(fd, buffer, 0, length, start);
    return buffer.subarray(0, read).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function parseLines(text, dropFirst) {
  const lines = text.split("\n");
  if (dropFirst) lines.shift();
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return out;
}

export function tailEntries(file, size = statSync(file).size) {
  const start = Math.max(0, size - TAIL_BYTES);
  return parseLines(readRange(file, start, size - start), start > 0);
}

function firstEntry(file) {
  const text = readRange(file, 0, HEAD_BYTES);
  const end = text.indexOf("\n");
  try {
    return JSON.parse(end === -1 ? text : text.slice(0, end));
  } catch {
    return null;
  }
}

function listDir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function recentFiles(dir, since, depth) {
  const found = [];
  for (const entry of listDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && depth > 0) {
      found.push(...recentFiles(path, since, depth - 1));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      const stat = statSync(path);
      if (stat.mtimeMs >= since)
        found.push({ path, mtime: stat.mtimeMs, size: stat.size });
    }
  }
  return found;
}

export function projectName(cwd, cache = new Map()) {
  if (!cwd) return "Unsorted";
  if (cache.has(cwd)) return cache.get(cwd);
  let dir = cwd;
  let name = basename(cwd) || cwd;
  while (true) {
    if (existsSync(join(dir, ".git"))) {
      name = basename(dir) || name;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cache.set(cwd, name);
  return name;
}

export function claudeStatus(entries, idleMs) {
  const turns = entries.filter(
    (entry) =>
      (entry.type === "user" || entry.type === "assistant") &&
      !entry.isSidechain,
  );
  const last = turns.at(-1);
  if (!last) return "idle";
  if (last.type === "assistant") {
    if (last.message?.stop_reason !== "tool_use") return "idle";
    if (idleMs <= RUNNING_MS) return "running";
    return idleMs <= WAITING_MS ? "waiting" : "idle";
  }
  return idleMs <= RUNNING_MS ? "running" : "idle";
}

export function codexStatus(entries, idleMs) {
  const events = entries
    .filter((entry) => entry.type === "event_msg")
    .map((entry) => entry.payload?.type);
  const started = events.lastIndexOf("task_started");
  const ended = Math.max(
    events.lastIndexOf("task_complete"),
    events.lastIndexOf("turn_aborted"),
  );
  if (started === -1 || ended > started) return "idle";
  if (idleMs <= RUNNING_MS) return "running";
  return idleMs <= WAITING_MS ? "waiting" : "idle";
}

function claudeTitle(entries) {
  let ai = "";
  let custom = "";
  for (const entry of entries) {
    if (entry.type === "custom-title" && entry.customTitle)
      custom = entry.customTitle;
    if (entry.type === "ai-title" && entry.aiTitle) ai = entry.aiTitle;
  }
  return custom || ai;
}

function codexTitles(home) {
  const titles = new Map();
  const file = join(home, ".codex", "session_index.jsonl");
  if (!existsSync(file)) return titles;
  for (const entry of parseLines(readFileSync(file, "utf8"), false))
    if (entry.id && entry.thread_name) titles.set(entry.id, entry.thread_name);
  return titles;
}

function scanClaude(home, since, now, cache) {
  const root = join(home, ".claude", "projects");
  const agents = [];
  for (const file of recentFiles(root, since, 1)) {
    const entries = tailEntries(file.path, file.size);
    const cwd = entries.findLast((entry) => entry.cwd)?.cwd;
    if (!cwd) continue;
    const id = basename(file.path, ".jsonl");
    const helpers = recentFiles(
      join(dirname(file.path), id, "subagents"),
      now - HELPER_MS,
      0,
    ).length;
    agents.push({
      key: `claude-${id}`,
      source: "claude",
      project: projectName(cwd, cache),
      status: claudeStatus(entries, now - file.mtime),
      lastActivity: new Date(file.mtime).toISOString(),
      title: claudeTitle(entries),
      helpers,
    });
  }
  return agents;
}

function scanCodex(home, since, now, cache) {
  const root = join(home, ".codex", "sessions");
  const titles = codexTitles(home);
  const sessions = [];
  const helpers = new Map();
  for (const file of recentFiles(root, since, 3)) {
    const meta = firstEntry(file.path)?.payload;
    if (!meta?.cwd || !meta.id) continue;
    const parent = meta.source?.subagent?.thread_spawn?.parent_thread_id;
    if (meta.source?.subagent) {
      if (parent && now - file.mtime <= HELPER_MS)
        helpers.set(parent, (helpers.get(parent) ?? 0) + 1);
      continue;
    }
    sessions.push({ file, meta });
  }
  return sessions.map(({ file, meta }) => ({
    key: `codex-${meta.id}`,
    source: "codex",
    project: projectName(meta.cwd, cache),
    status: codexStatus(tailEntries(file.path, file.size), now - file.mtime),
    lastActivity: new Date(file.mtime).toISOString(),
    title: titles.get(meta.id) ?? "",
    helpers: helpers.get(meta.id) ?? 0,
  }));
}

export function machineName() {
  if (process.env.STATION_MACHINE_NAME) return process.env.STATION_MACHINE_NAME;
  let name = "";
  if (platform() === "darwin") {
    const result = spawnSync("scutil", ["--get", "ComputerName"], {
      encoding: "utf8",
    });
    if (result.status === 0) name = result.stdout.trim();
  }
  return (name || hostname().replace(/\.local$/, "")).replace(/\s\(\d+\)$/, "");
}

export function scanSessions({
  home = homedir(),
  now = Date.now(),
  days = 3,
} = {}) {
  const since = now - days * 24 * 60 * 60 * 1000;
  const cache = new Map();
  const name = machineName();
  return {
    generatedAt: new Date(now).toISOString(),
    machine: { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name },
    agents: [
      ...scanClaude(home, since, now, cache),
      ...scanCodex(home, since, now, cache),
    ].sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity)),
  };
}
