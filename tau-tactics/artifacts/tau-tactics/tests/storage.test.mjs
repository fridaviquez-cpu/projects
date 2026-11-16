// Run with node tests/storage.test.mjs. Vite loads the actual TS modules, no generated copy.
import assert from "node:assert/strict";
import { createServer } from "vite";

const data = new Map();
let failure = "";
globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem(key) { if (failure === "read") throw new Error("blocked"); return data.get(key) ?? null; },
  setItem(key, value) { if (failure === "quota" || failure === "blocked") throw new Error(failure); data.set(key, value); },
};
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
try {
  const { readLS, readLSStrict, writeLS, repairStorage, KEYS } = await server.ssrLoadModule("/src/lib/store.ts");
  const { fresh } = await server.ssrLoadModule("/src/lib/timer-core.ts");
  const { validateStored } = await server.ssrLoadModule("/src/lib/storage-validation.ts");
  const { readDraft, writeDraft, reflectionKey, promptKey, clearSessionDrafts } = await server.ssrLoadModule("/src/lib/drafts.ts");
  const { scoreSessions } = await server.ssrLoadModule("/src/lib/companion.ts");
  const { focusHistory, sessionPrompt } = await server.ssrLoadModule("/src/lib/session-cycle.ts");
  const legacy = { id: "legacy", task: "Circuits", minutes: 25, completedAt: 1000 };
  let updates = 0;
  window.addEventListener("tau-store", () => updates++);
  assert.equal(writeLS(KEYS.sessions, [legacy]).ok, true);
  assert.deepEqual(readLS(KEYS.sessions, []), [legacy], "optional legacy fields stay readable");
  for (const kind of ["quota", "blocked", "read"]) {
    failure = kind;
    const count = updates;
    assert.equal(writeLS(KEYS.sessions, []).ok, false);
    assert.equal(updates, count, "failure must not announce a successful update");
    assert.deepEqual(JSON.parse(data.get(KEYS.sessions)), [legacy]);
  }
  failure = "";
  for (const bad of [null, {}, { ...legacy, completedAt: 1e30 }, { ...legacy, reflection: { takeaway: 17 } }]) {
    const original = JSON.stringify([legacy, bad]);
    data.set(KEYS.sessions, original);
    assert.deepEqual(readLS(KEYS.sessions, []), [legacy]);
    assert.throws(() => readLSStrict(KEYS.sessions, []), "timer writer must not build on partial history");
    assert.equal(writeLS(KEYS.sessions, []).ok, false);
    assert.equal(data.get(KEYS.sessions), original, "malformed entries must not be overwritten");
  }
  const original = JSON.stringify([legacy, null]);
  data.set(KEYS.sessions, original);
  failure = "quota";
  assert.equal(repairStorage({ key: KEYS.sessions, raw: original, recoverable: [legacy] }).ok, false);
  assert.equal(data.get(KEYS.sessions), original);
  failure = "";
  assert.equal(repairStorage({ key: KEYS.sessions, raw: original, recoverable: [legacy] }).ok, true);
  assert.ok([...data.entries()].some(([key, value]) => key.includes(".quarantine.") && value === original));
  assert.deepEqual(readLS(KEYS.sessions, []), [legacy]);
  data.set(KEYS.sessions, "{broken");
  assert.deepEqual(readLS(KEYS.sessions, []), []);
  assert.equal(writeLS(KEYS.sessions, []).ok, false);
  assert.equal(data.get(KEYS.sessions), "{broken");
  assert.equal(validateStored(KEYS.timer, { phases: [] }).invalid, true);
  const ready = { ...fresh(25), index: 2, status: "ready" };
  assert.equal(validateStored(KEYS.timer, ready).invalid, false);
  assert.equal(writeLS(KEYS.timer, ready).ok, true);
  assert.equal(readLSStrict(KEYS.timer, null).status, "ready");
  assert.equal(validateStored(KEYS.favorites, {}).invalid, true);
  const reflection = { recalled: false, practiced: true, takeaway: "My explanation", unclear: "Voltage signs" };
  writeDraft(reflectionKey("one"), reflection);
  writeDraft(reflectionKey("two"), { ...reflection, takeaway: "Other session" });
  writeDraft(promptKey("one", "quiz"), "Quiz edit");
  writeDraft(promptKey("one", "review"), "Review edit");
  assert.deepEqual(readDraft(reflectionKey("one")), reflection);
  assert.equal(readDraft(reflectionKey("two")).takeaway, "Other session");
  assert.equal(readDraft(promptKey("one", "quiz")), "Quiz edit");
  assert.equal(readDraft(promptKey("one", "review")), "Review edit");
  assert.deepEqual(JSON.parse(data.get(reflectionKey("one"))), reflection, "reload source has draft");
  failure = "quota";
  assert.equal(writeDraft(reflectionKey("one"), { ...reflection, takeaway: "Recover me" }).ok, false);
  assert.equal(readDraft(reflectionKey("one")).takeaway, "Recover me", "failed writing remains recoverable");
  assert.equal(JSON.parse(data.get(reflectionKey("one"))).takeaway, reflection.takeaway);
  failure = "";
  writeDraft(reflectionKey("one"), null);
  assert.equal(readDraft(reflectionKey("one")), null, "discard restores saved-value fallback");
  data.set(KEYS.sessions, JSON.stringify([legacy]));
  const edited = { ...legacy, reflection };
  assert.equal(writeLS(KEYS.sessions, [edited]).ok, true);
  assert.equal(readLS(KEYS.sessions, []).length, 1, "reflection edits never add sessions");
  assert.equal(scoreSessions(readLS(KEYS.sessions, [])).score, 3);
  writeLS(KEYS.sessions, [edited]);
  assert.equal(scoreSessions(readLS(KEYS.sessions, [])).score, 3, "re-saving does not duplicate credit");
  assert.equal(focusHistory(readLS(KEYS.sessions, [])).totalMinutes, 25);
  assert.ok(sessionPrompt(edited, "quiz").includes("Voltage signs"));
  assert.equal(writeLS(KEYS.sessions, []).ok, true);
  assert.deepEqual(readLS(KEYS.sessions, []), [], "deletion visible to derived consumers");
  assert.equal(scoreSessions(readLS(KEYS.sessions, [])).score, 0);
  assert.equal(focusHistory(readLS(KEYS.sessions, [])).totalMinutes, 0);
  clearSessionDrafts("one");
  assert.equal(readDraft(promptKey("one", "quiz")), null);
  assert.equal(readDraft(promptKey("one", "review")), null);
  assert.equal(readDraft(reflectionKey("two")).takeaway, "Other session");
  console.log("Storage regression checks passed: failures, legacy validation, quarantine, drafts, edit and delete.");
} finally {
  await server.close();
}
