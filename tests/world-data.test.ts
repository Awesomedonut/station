import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { safeHref } from "../src/lib/links";
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadWorldData, parseWorldData } from "../src/lib/world-data";
import { layoutWorld } from "../src/modules/agentworld/model";
import { THEMES, themeOf } from "../src/modules/agentworld/themes";
import sample from "../examples/world.json";

test("donut and candyland skins remain available", () => {
  assert.deepEqual(Object.keys(THEMES), ["donut", "candyland", "donuttray"]);
  assert.equal(THEMES.candyland.name, "Candyland");
  assert.equal(themeOf("crown").id, "donut");
});
test("sample data renders all six states and marks the waiting agent", async () => {
  const data = await loadWorldData("");
  assert.equal(data.sample, true);
  const world = layoutWorld(data.agents);
  assert.equal(world.units.length, 6);
  assert.equal(world.alerts.length, 1);
  assert.equal(world.alerts[0].agent.state, "waiting");
});
test("configured missing files never fall back to samples", async () => {
  await assert.rejects(loadWorldData("/nonexistent/station-snapshot.json"));
});
test("malformed snapshots and broken references are rejected", () => {
  assert.throws(() => parseWorldData({ agents: {} }));
  const data = structuredClone(sample);
  data.agents.agents[0].machineId = "missing";
  assert.throws(() => parseWorldData(data));
});

test("prototype names cannot select a theme", () => {
  for (const name of ["__proto__", "constructor", "toString", "missing"]) {
    assert.equal(themeOf(name).id, "donut");
  }
});

test("snapshots reject coerced enums and invalid numbers", () => {
  const data = structuredClone(sample);
  Object.assign(data.agents.agents[0], { state: ["running"] });
  assert.throws(() => parseWorldData(data));
  data.agents.agents[0].state = "running";
  data.agents.agents[0].minutes = Infinity;
  assert.throws(() => parseWorldData(data));
});

test("snapshots reject executable and protocol-relative links", () => {
  for (const href of [
    "javascript:alert(1)",
    "//example.com",
    "/\\example.com",
    "https://user:secret@example.com",
  ]) {
    const data = structuredClone(sample);
    data.agents.agents[0].href = href;
    assert.throws(() => parseWorldData(data));
  }
});

test("configured snapshots load real data and reject malformed files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "station-test-"));
  const file = join(directory, "world.json");
  try {
    await writeFile(file, JSON.stringify(sample));
    const data = await loadWorldData(file);
    assert.equal(data.sample, false);
    assert.equal(data.agents.agents.length, 6);
    await writeFile(file, "{");
    await assert.rejects(loadWorldData(file));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("links preserve valid destinations and reject control characters", () => {
  assert.equal(safeHref("/agents/123?view=detail"), "/agents/123?view=detail");
  assert.equal(
    safeHref("https://example.com/agents/123"),
    "https://example.com/agents/123",
  );
  for (const href of [
    "javascript:alert(1)",
    "/\\example.com",
    "//example.com",
    "https://example.com/\nfoo",
  ]) {
    assert.equal(safeHref(href), "");
  }
});
