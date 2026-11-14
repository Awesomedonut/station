import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claudeStatus,
  codexStatus,
  projectName,
  scanSessions,
} from "../scripts/sessions.mjs";

const MINUTE = 60 * 1000;

function jsonl(path: string, entries: unknown[], mtime: number) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  utimesSync(path, mtime / 1000, mtime / 1000);
}

test("claude status follows the last turn and how long the file is quiet", () => {
  const ended = [{ type: "assistant", message: { stop_reason: "end_turn" } }];
  const tool = [{ type: "assistant", message: { stop_reason: "tool_use" } }];
  const prompt = [{ type: "user", message: { content: "hi" } }];
  assert.equal(claudeStatus(ended, 0), "idle");
  assert.equal(claudeStatus(tool, MINUTE), "running");
  assert.equal(claudeStatus(tool, 10 * MINUTE), "waiting");
  assert.equal(claudeStatus(tool, 90 * MINUTE), "idle");
  assert.equal(claudeStatus(prompt, MINUTE), "running");
  assert.equal(claudeStatus(prompt, 10 * MINUTE), "idle");
  assert.equal(claudeStatus([], 0), "idle");
});

test("codex status follows task start and completion events", () => {
  const event = (type: string) => ({ type: "event_msg", payload: { type } });
  const open = [event("task_complete"), event("task_started")];
  assert.equal(codexStatus(open, MINUTE), "running");
  assert.equal(codexStatus(open, 10 * MINUTE), "waiting");
  assert.equal(codexStatus([...open, event("task_complete")], 0), "idle");
  assert.equal(codexStatus([...open, event("turn_aborted")], 0), "idle");
  assert.equal(codexStatus([], 0), "idle");
});

test("project name is the git repository that holds the folder", () => {
  const root = mkdtempSync(join(tmpdir(), "station-project-"));
  try {
    mkdirSync(join(root, "shop", ".git"), { recursive: true });
    mkdirSync(join(root, "shop", "web", "src"), { recursive: true });
    mkdirSync(join(root, "loose"), { recursive: true });
    assert.equal(projectName(join(root, "shop", "web", "src")), "shop");
    assert.equal(projectName(join(root, "loose")), "loose");
    assert.equal(projectName(""), "Unsorted");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scan reads claude and codex sessions from a home folder", () => {
  const home = mkdtempSync(join(tmpdir(), "station-home-"));
  const now = Date.now();
  process.env.STATION_MACHINE_NAME = "Test machine";
  try {
    const cwd = join(home, "work", "shop");
    mkdirSync(join(cwd, ".git"), { recursive: true });
    const claude = join(home, ".claude", "projects", "-work-shop");
    jsonl(
      join(claude, "c1.jsonl"),
      [
        { type: "ai-title", aiTitle: "Fix checkout" },
        {
          type: "assistant",
          cwd,
          message: { stop_reason: "tool_use" },
        },
      ],
      now - MINUTE,
    );
    jsonl(join(claude, "c1", "subagents", "a.jsonl"), [{}], now);
    jsonl(
      join(claude, "old.jsonl"),
      [{ type: "user", cwd }],
      now - 10 * 24 * 60 * MINUTE,
    );
    const day = join(home, ".codex", "sessions", "2026", "01", "02");
    const meta = (id: string, source: unknown) => ({
      type: "session_meta",
      payload: { id, cwd, source },
    });
    jsonl(
      join(day, "a.jsonl"),
      [
        meta("x1", "cli"),
        { type: "event_msg", payload: { type: "task_started" } },
        { type: "event_msg", payload: { type: "task_complete" } },
      ],
      now - 20 * MINUTE,
    );
    jsonl(
      join(day, "b.jsonl"),
      [meta("x2", { subagent: { thread_spawn: { parent_thread_id: "x1" } } })],
      now,
    );
    writeFileSync(
      join(home, ".codex", "session_index.jsonl"),
      JSON.stringify({ id: "x1", thread_name: "Write tests" }) + "\n",
    );
    const report = scanSessions({ home, now });
    assert.deepEqual(report.machine, {
      id: "test-machine",
      name: "Test machine",
    });
    assert.deepEqual(
      report.agents.map((a) => [
        a.key,
        a.status,
        a.project,
        a.title,
        a.helpers,
      ]),
      [
        ["claude-c1", "running", "shop", "Fix checkout", 1],
        ["codex-x1", "idle", "shop", "Write tests", 1],
      ],
    );
  } finally {
    delete process.env.STATION_MACHINE_NAME;
    rmSync(home, { recursive: true, force: true });
  }
});
