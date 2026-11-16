import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the actual pure modules, without a browser or a test-only timer implementation.
function moduleUrl(path, replacements = {}) {
  let source = readFileSync(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const coreUrl = moduleUrl("../src/lib/timer-core.ts");
const { fresh, restore, settle, transition, breakFor, validLengths, needsReplacementConfirmation } = await import(coreUrl);
const { protocol } = await import(moduleUrl("../src/lib/content.ts", { '"./timer-core"': JSON.stringify(coreUrl) }));
const start = (d = 25, b = 5) => transition(fresh(d, "Read chapter", b, { subject: "Physics", intention: "Read" }), "start", 0).state;

test("plan handoff carries context through reload and reset without starting", async () => {
  const { planContext } = await import(coreUrl);
  const plan = { duration: 90, task: " Practice proofs ", name: "Math review", method: "Pomodoro blocks", notes: "Try without notes first", ai: "No AI this session", breakStyle: "Walk" };
  const context = planContext(plan);
  const timer = fresh(plan.duration, context.task, breakFor(plan.duration), context);
  assert.equal(timer.status, "idle");
  assert.equal(timer.task, "Practice proofs");
  assert.equal(timer.phases[1].minutes, 15);
  assert.equal(timer.subject, "");
  assert.equal(timer.intention, "Study");
  assert.deepEqual(restore(JSON.parse(JSON.stringify(timer))).plan, context.plan);
  assert.deepEqual(fresh(timer.duration, timer.task, 15, timer).plan, context.plan);
  assert.equal(planContext({ ...plan, task: undefined }).task, "Math review");
  assert.equal(planContext({ ...plan, name: "", task: "" }).task, "");
  assert.equal(planContext({ ...plan, task: "x".repeat(200) }).task.length, 120);
  const text = protocol(plan);
  assert.match(text, /Task: Practice proofs/);
  assert.match(text, /INDEPENDENT STUDY/);
  assert.match(text, /check your reasoning against course notes/);
  assert.doesNotMatch(text, /undefined|AI enhances/);
});

test("old timers remain valid and malformed plan context fails explicitly", () => {
  const old = JSON.parse(JSON.stringify(fresh()));
  delete old.plan;
  assert.equal(restore(old).plan, undefined);
  assert.throws(() => restore({ ...old, plan: { notes: 42 } }), /plan context is invalid/);
});

test("saved custom plans preserve independent intervals and legacy defaults", async () => {
  const { planContext } = await import(coreUrl);
  for (const [duration, breakMinutes] of [[37, 8], [25, 20], [180, 60], [1, 1], [90, undefined]]) {
    const saved = JSON.parse(JSON.stringify({
      id: "custom", name: "Review", duration, breakMinutes, method: "Pomodoro blocks",
      ai: "No AI this session", breakStyle: "Walk", notes: "Review notes", createdAt: 1,
    }));
    const b = saved.breakMinutes ?? breakFor(saved.duration);
    assert.equal(validLengths(saved.duration, b), true);
    const context = planContext(saved);
    const state = restore(JSON.parse(JSON.stringify(fresh(saved.duration, context.task, b, context))));
    assert.deepEqual(state.phases.map(p => p.minutes), [duration, b, duration, b]);
    assert.equal(state.status, "idle");
    assert.ok(protocol(saved).includes(`Focus ${duration} min / Break ${b} min`));
  }
});

test("plan interval validation rejects blank, fractional and out-of-range lengths", () => {
  for (const [d, b] of [[0, 5], [181, 5], [25, 0], [25, 61], [1.5, 5], [25, 2.5], [NaN, 5], [25, Infinity]]) {
    assert.equal(validLengths(d, b), false);
  }
});

test("away and reload only complete the explicitly started block", () => {
  const result = settle(start(), 200 * 60000);
  assert.equal(result.state.status, "ready");
  assert.equal(result.state.index, 2);
  assert.deepEqual(result.completions, [{ index: 0, completedAt: 25 * 60000 }]);
  const restored = restore(JSON.parse(JSON.stringify(result.state)));
  assert.deepEqual(settle(restored, 500 * 60000).completions, []);
  const next = transition(restored, "start", 500 * 60000).state;
  assert.equal(next.endAt, 525 * 60000);
  assert.deepEqual(settle(next, 600 * 60000).completions, [{ index: 2, completedAt: 525 * 60000 }]);
});
test("pause before, at and after a boundary is deterministic", () => {
  const s = start();
  const paused = transition(s, "pause", 1000).state;
  assert.equal(paused.remainingMs, 25 * 60000 - 1000);
  assert.equal(settle(paused, 99999999).state.status, "paused");
  const resumed = transition(paused, "start", 5000).state;
  assert.equal(resumed.endAt, 25 * 60000 + 4000);
  for (const time of [25 * 60000, 25 * 60000 + 1]) {
    const r = transition(s, "pause", time);
    assert.equal(r.state.index, 1);
    assert.equal(r.state.status, "running");
    assert.equal(r.completions.length, 1);
  }
});
test("skip never awards unfinished focus or starts another focus", () => {
  const skipped = transition(start(), "skip", 1000);
  assert.equal(skipped.completions.length, 0);
  assert.equal(skipped.state.index, 1);
  const ready = transition(skipped.state, "skip", 2000);
  assert.equal(ready.state.status, "ready");
  assert.equal(ready.state.endAt, null);
  assert.equal(settle(ready.state, 99999999).completions.length, 0);
  assert.equal(transition(start(), "skip", 25 * 60000).state.index, 1);
});
test("completion replay has stable IDs; settled state is idempotent", () => {
  const s = start();
  const ids = new Set();
  for (let i = 0; i < 3; i++) for (const c of settle(restore(JSON.parse(JSON.stringify(s))), 99999999).completions) ids.add(`${s.runId}-${c.index}`);
  assert.equal(ids.size, 1);
  const result = settle(s, 99999999);
  assert.deepEqual(settle(result.state, 99999999).completions, []);
});
test("presets and independent custom intervals round-trip and copy consistently", () => {
  for (const [d, b] of [[25, 5], [50, 10], [90, 15], [37, 8]]) {
    const state = restore(JSON.parse(JSON.stringify(fresh(d, "Task", b))));
    assert.equal(state.duration, d);
    assert.equal(state.phases[1].minutes, b);
    const text = protocol({ duration: d, breakMinutes: b, ai: "", method: "", breakStyle: "" });
    assert.ok(text.includes(`Focus ${d} min / Break ${b} min`));
    assert.equal(fresh(d, state.task, b, state).phases[1].minutes, b);
  }
  for (const [d, b] of [[25, 5], [50, 10], [90, 15]]) {
    assert.equal(breakFor(d), b);
    assert.ok(protocol({ duration: d, ai: "", method: "", breakStyle: "" }).includes(`Break ${b} min`));
  }
});
test("replacement guards paused, running and waiting runs; legacy later phases never earn credit", () => {
  assert.equal(needsReplacementConfirmation(fresh()), false);
  const s = start(37, 8);
  for (const status of ["running", "paused", "ready"]) assert.equal(needsReplacementConfirmation({ ...s, status }), true);
  const legacy = { ...s, version: undefined, index: 2 };
  assert.equal(restore(legacy).status, "ready");
  assert.equal(settle(restore(legacy), 99999999).completions.length, 0);
  assert.throws(() => restore({ phases: [] }));
});
