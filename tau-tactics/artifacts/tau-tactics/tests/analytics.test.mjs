import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { trackReviewOutcome } from "../src/lib/analytics.ts";
import { mutateReview, reviewKey } from "../src/lib/reviews.ts";

// Execute the actual UI save handlers without a DOM or a tracking network.
// This keeps success/failure gating under test, not a duplicate implementation.
function handler(file, name, scope) {
  const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(initializer, `Missing ${name}`);
  const js = ts.transpileModule(`const handler = ${initializer.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return Function(...Object.keys(scope), `${js}; return handler;`)(...Object.values(scope));
}

const component = "../src/components/review-next.tsx";
const page = "../src/pages/review.tsx";
const noop = () => {};

function setup(tracker = "capture") {
  const events = [];
  const values = new Map([["tau.sessions.v1", JSON.stringify([{ id: "private-source", reflection: { unclear: "private-note" } }])]]);
  const storage = {
    getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: k => values.delete(k),
  };
  globalThis.window = {};
  if (tracker === "capture") window.umami = { track: fn => events.push(fn({
    website: "site", url: "/review/private-source?topic=private-note",
    title: "private-note", referrer: "/focus?note=private-note",
    id: "private-source", data: { note: "private-note" },
  })) };
  if (tracker === "throw") window.umami = { track() { throw Error("tracker failed"); } };
  if (tracker === "reject") window.umami = { track() { return Promise.reject(Error("network failed")); } };
  let item;
  const scope = {
    topic: "private-note", date: "", session: { id: "private-source" },
    trackReviewOutcome, setSaving: noop, setError: noop, setStatus: noop,
    setOpen: noop, reload: noop, setPendingAttempt: noop, setAttempt: noop,
    setAttErr: noop, setNextErr: noop, nextDate: "",
    createReview: async (sessionId, topic, date) => {
      const r = mutateReview(storage, { kind: "create", sessionId, topic, date });
      if (r.ok) item = r.item;
      return r;
    },
    run: async patch => {
      const r = mutateReview(storage, { kind: "update", item, patch });
      if (r.ok) item = r.item;
      return r.ok;
    },
  };
  return { events, values, storage, scope };
}

test("successful UI saves emit only allowlisted activity/choice metadata", async () => {
  const { events, scope } = setup();
  const save = handler(component, "save", scope);
  await save();
  await save(); // Existing item is not a second creation.
  await handler(page, "saveAttempt", scope)("private-attempt");
  for (const next of ["revisit", "example", "pause"]) {
    await handler(page, "saveNext", { ...scope, next })();
  }
  assert.deepEqual(events.map(e => [e.name, e.data]), [
    ["review_created", { evidence: "activity_only" }],
    ["review_attempt_saved", { evidence: "activity_only" }],
    ...["revisit", "example", "pause"].map(action => ["review_next_action_saved", { evidence: "learner_choice", action }]),
  ]);
  for (const e of events) {
    assert.deepEqual(Object.keys(e).sort(), ["website", "name", "url", "title", "referrer", "data"].sort());
    assert.equal(e.url, "/review");
    assert.equal(e.referrer, "");
    assert.equal(e.title, "Review");
    assert.doesNotMatch(JSON.stringify(e), /private-/);
  }
});

test("failed writes and invalid inputs do not emit successful outcomes", async () => {
  const { events, scope, storage } = setup();
  await handler(component, "save", { ...scope, topic: " " })();
  assert.equal(events.length, 0);
  const setItem = storage.setItem;
  storage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  await handler(component, "save", scope)();
  assert.equal(events.length, 0);
  storage.setItem = setItem;
  await handler(component, "save", scope)();
  events.length = 0;
  storage.setItem = () => { throw new DOMException("blocked", "SecurityError"); };
  await handler(page, "saveAttempt", scope)("private-attempt");
  await handler(page, "saveNext", { ...scope, next: "pause" })();
  await handler(page, "saveNext", { ...scope, next: undefined })();
  assert.equal(events.length, 0);
});

test("missing or broken analytics cannot break local creation, attempts, or choices", async () => {
  for (const tracker of ["absent", "throw", "reject"]) {
    const { scope, values } = setup(tracker);
    await handler(component, "save", scope)();
    await handler(page, "saveAttempt", scope)("private-attempt");
    await handler(page, "saveNext", { ...scope, next: "pause" })();
    const item = JSON.parse(values.get(reviewKey("private-source")));
    assert.equal(item.attempt, "private-attempt");
    assert.equal(item.nextAction, "pause");
  }
  await new Promise(resolve => setImmediate(resolve)); // Surface unhandled rejections.
});

test("SSR and unexpected runtime event/action values are safe", () => {
  delete globalThis.window;
  assert.doesNotThrow(() => trackReviewOutcome("review_created"));
  const { events } = setup();
  trackReviewOutcome("private-note");
  trackReviewOutcome("review_next_action_saved", "private-note");
  assert.deepEqual(events, []);
});
