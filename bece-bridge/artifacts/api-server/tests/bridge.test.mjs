import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import router from "../src/routes/bridge.ts";
import { makeQuestions } from "../src/lib/bridge-learning.ts";
import { withMaterialLocks, deleteMaterialRecords } from "../src/lib/material-lifecycle.ts";
import { setTestCompletion } from "./no-ai.mjs";
import "../src/lib/tutor-arithmetic.test.ts";
import "../src/lib/tutor-quantities.test.ts";
import { labelTutorArithmetic } from "../src/lib/tutor-arithmetic.ts";
import { calculateVisual } from "../src/lib/visual-models.ts";
import { visualVersion } from "../src/lib/visual-version.ts";
import {
  db, bridgeVisitors, bridgeAssessments, bridgePilotCourses, bridgeResources, bridgeMaterials, bridgeVisuals,
  setupDatabase, teardownDatabase, raceSubmissions, holdResourceSnapshot,
} from "./database.mjs";

const app = express();
app.use(express.json());
// Synthetic identities only in this isolated-schema test process.
app.use((req, _res, next) => {
  if (req.get("X-Test-User")) req.user = { id: req.get("X-Test-User") };
  req.log = { info() {}, warn() {}, error() {} };
  next();
});
app.use("/api", router);
before(async () => {
  await setupDatabase();
  await db.insert(bridgePilotCourses).values(
    ["110", "120", "210", "220", "310"].map(courseId => ({ courseId, isPilot: true })),
  );
});
after(teardownDatabase);

test("non-AI saved fixtures retain sources across sessions and deny foreign access before deletion", async () => {
  // Synthetic stored output only, in the isolated test schema. No provider call
  // or live quota mutation: this verifies persistence/authorization, not AI quality.
  const cookieA = await visitor(), cookieB = await visitor(), reopenedCookie = await visitor();
  const a = randomUUID(), b = randomUUID(), materialId = randomUUID();
  const resourceId = randomUUID(), visualId = randomUUID();
  await db.insert(bridgeMaterials).values({ id: materialId, ownerId: a, courseId: "210",
    title: "Synthetic resistor lecture", objectPath: "fixture",
    pages: [{ page: 1, text: "An ideal resistor obeys I=V/R. R=1000 ohms." }] });
  const source = { title: "Synthetic resistor lecture — page 1",
    url: `/materials/${materialId}#page-1`, kind: "Private material", checkedAt: "2026-11-07" };
  const resource = { id: resourceId, courseId: "210", sourceMode: "materials",
    materialIds: [materialId], kind: "explanation", topic: "Ohm's law",
    title: "Synthetic persisted explanation", content: "I=V/R. Synthetic test output.",
    createdAt: new Date().toISOString(), sources: [source], disclaimer: "Synthetic test fixture",
    conversation: { revision: 0, turns: [] } };
  await db.insert(bridgeResources).values({ id: resourceId, visitorId: cookieA.split("=")[1], ownerUserId: a, resource });
  await db.insert(bridgeVisuals).values({ id: visualId, visitorId: cookieA.split("=")[1], ownerUserId: a,
    prompt: "Synthetic resistor plot", modelVersion: visualVersion("ohm"), materialIds: [materialId],
    result: { ...calculateVisual("210", "ohm", { r: 1 }), sources: [source] } });
  const call = (method, path, cookie, user) => {
    const req = request(app)[method](path).set("Cookie", cookie).set("X-Bridge-Request", "1");
    return user ? req.set("X-Test-User", user) : req;
  };
  for (const cookie of [cookieA, reopenedCookie]) {
    const resources = await call("get", "/api/bridge/resources", cookie, a).expect(200);
    assert.deepEqual(resources.body.find(r => r.id === resourceId).sources, [source]);
    assert.deepEqual(resources.body.find(r => r.id === resourceId).materialIds, [materialId]);
    await call("get", `/api/bridge/resources/${resourceId}/conversation`, cookie, a).expect(200);
    const visuals = await call("get", "/api/bridge/visuals/saved", cookie, a).expect(200);
    assert.equal(visuals.body.find(v => v.id === visualId).result.courseId, "210");
    assert.deepEqual(visuals.body.find(v => v.id === visualId).materialIds, [materialId]);
  }
  // Include an unauthenticated browser carrying A's visitor cookie: ownership
  // must depend on the signed-in account, not possession of the visitor cookie.
  for (const [cookie, user] of [[cookieB, b], [cookieA, undefined]]) {
    const resources = await call("get", "/api/bridge/resources", cookie, user).expect(200);
    assert.ok(!resources.body.some(r => r.id === resourceId));
    await call("get", `/api/bridge/resources/${resourceId}/conversation`, cookie, user).expect(404);
    await call("delete", `/api/bridge/resources/${resourceId}/conversation`, cookie, user).expect(404);
    await call("delete", `/api/bridge/resources/${resourceId}`, cookie, user).expect(404);
    const visuals = await call("get", "/api/bridge/visuals/saved", cookie, user).expect(200);
    assert.ok(!visuals.body.some(v => v.id === visualId));
    await call("patch", `/api/bridge/visuals/saved/${visualId}`, cookie, user).send({ values: { r: 2 } }).expect(404);
    await call("delete", `/api/bridge/visuals/saved/${visualId}`, cookie, user).expect(404);
  }
  await call("patch", `/api/bridge/visuals/saved/${visualId}`, reopenedCookie, a).send({ values: { r: 2 } }).expect(200);
  const reopened = await call("get", "/api/bridge/visuals/saved", cookieA, a).expect(200);
  assert.equal(reopened.body.find(v => v.id === visualId).result.controls.find(c => c.key === "r").value, 2);
  await call("delete", `/api/bridge/visuals/saved/${visualId}`, cookieA, a).expect(204);
  await call("delete", `/api/bridge/resources/${resourceId}`, cookieA, a).expect(204);
});

test("source deletion serializes with derived creation in either order", async () => {
  const cookie = await visitor(), owner = randomUUID(), id = randomUUID(), resourceId = randomUUID();
  await db.insert(bridgeMaterials).values({ id, ownerId: owner, courseId: "210", title: "Race fixture", objectPath: "fixture", pages: [{ page: 1, text: "RC circuit" }] });
  let release, locked;
  const gate = new Promise(resolve => { release = resolve; });
  const acquired = new Promise(resolve => { locked = resolve; });
  const writer = withMaterialLocks([id], owner, "210", async tx => {
    locked(); await gate;
    await tx.insert(bridgeResources).values({ id: resourceId, visitorId: cookie.split("=")[1], ownerUserId: owner, resource: { materialIds: [id], content: "Private fixture text" } });
  });
  await acquired;
  const deletion = deleteMaterialRecords(id, owner, "210");
  release();
  await Promise.all([writer, deletion]);
  assert.deepEqual(await db.select().from(bridgeResources).where(eq(bridgeResources.id, resourceId)), []);
  let wrote = false;
  await assert.rejects(withMaterialLocks([id], owner, "210", async () => { wrote = true; }));
  assert.equal(wrote, false, "Deletion-first ordering prevents any new derived write");
});

test("combined follow-up retains private and shared evidence while materials-only excludes shared", async () => {
  const cookie = await visitor(), owner = randomUUID(), material = randomUUID(), id = randomUUID();
  await db.insert(bridgeMaterials).values({ id: material, ownerId: owner, courseId: "210", title: "Private circuit", objectPath: "fixture", pages: [{ page: 1, text: "A circuit lecture about current in an RC circuit." }] });
  const resource = { courseId: "210", sourceMode: "combined", topic: "circuit current kirchhoff", content: "Original context", materialIds: [material], sources: [] };
  await db.insert(bridgeResources).values({ id, visitorId: cookie.split("=")[1], ownerUserId: owner, resource });
  let providerAnswer;
  setTestCompletion(async request => {
    const prompt = request.messages[0].content;
    const evidence = JSON.parse(prompt.split("Evidence: ")[1].split("\nOriginal topic")[0]);
    assert.ok(evidence.some(e => e.url.startsWith(`/materials/${material}#`)));
    const shared = evidence.find(e => e.label.startsWith("S-"));
    assert.ok(shared, "Shared support must be present in combined turn");
    assert.match(prompt, /one line per calculation/);
    assert.match(prompt, /For explicit unit conversions/);
    assert.match(prompt, /quantities fenced block/);
    // Explicit reuse catches rounding; matching decimals alone leave provenance unchecked.
    // The last calculation also follows an unreliable (mismatched) reference.
    providerAnswer = `Shared circuit support [${shared.label}]\n\`\`\`arithmetic\nexp(-1) = 0.367879\n5 * ref(1) = 1.839395\n5/e = 1.839397\n1/3 = 0.33\n33/100 = 0.33\n0.33 * 3 = 0.99\nref(2) * 2 = 3.67879\n\`\`\`\n\`\`\`units\n1000 [mV] = 1 [V]\n1 [V] = 1 [A]\n1 [dB] = 1 [dB]\n\`\`\``;
    providerAnswer += "\n```quantities\n2 [mA] * 3 [kohm] = 6 [V]\n(2 [V] + 3 [A]) * 4 [A] = 20 [W]\n2 + 3 [V] = 5 [V]\n```";
    return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ answer: providerAnswer, supported: true, citations: [shared.label] }) } }] };
  });
  try {
    const result = await request(app).post(`/api/bridge/resources/${id}/conversation`)
      .set("Cookie", cookie).set("X-Test-User", owner).set("X-Bridge-Request", "1")
      .send({ question: "Explain capacitor impedance", mode: "teach", revision: 0, processingConsent: true }).expect(200);
    assert.match(result.body.turns[0].sources[0].kind, /Shared instructional/);
    const answer = result.body.turns[0].answer;
    assert.match(answer, /1 passed; 1 mismatched; 1 unchecked marked quantity calculations/);
    assert.match(answer, /1 passed; 1 mismatched; 1 unchecked marked conversions/);
    assert.match(answer, /incompatible dimensions/);
    assert.match(answer, /5 passed; 1 mismatched; 1 unchecked marked calculations/);
    assert.match(answer, /Calculation 2: recomputed value 1\.83939720586/);
    assert.match(answer, /Explicit reuse.*calculation\(s\) 1/);
    assert.match(answer, /Calculation 7:.*invalid, unsupported or follows an unreliable/);
    assert.match(answer, /dependency provenance remains unchecked/);
    assert.match(answer, /Invalid or unreliable references remain unchecked/);
    assert.match(answer, /\*\*Unchecked:\*\* quantity meaning, all other math/);
    assert.ok(answer.endsWith(`\n\n---\n\n${providerAnswer}`), "The original provider answer must remain intact below the report");
    const reopened = await request(app).get(`/api/bridge/resources/${id}/conversation`)
      .set("Cookie", cookie).set("X-Test-User", owner).expect(200);
    assert.equal(reopened.body.turns[0].answer, answer, "Reopening must preserve the dependency warning, unchecked wording and original answer unchanged");
    const [saved] = await db.select().from(bridgeResources).where(eq(bridgeResources.id, id));
    assert.equal(saved.resource.sourceMode, "combined");
    await db.update(bridgeResources).set({ resource: { ...resource, sourceMode: "materials" } }).where(eq(bridgeResources.id, id));
    setTestCompletion(async request => {
      const evidence = JSON.parse(request.messages[0].content.split("Evidence: ")[1].split("\nOriginal topic")[0]);
      assert.ok(evidence.every(e => !e.label.startsWith("S-")));
      return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ answer: "Missing evidence for this relationship.", supported: false, citations: [] }) } }] };
    });
    await request(app).post(`/api/bridge/resources/${id}/conversation`)
      .set("Cookie", cookie).set("X-Test-User", owner).set("X-Bridge-Request", "1")
      .send({ question: "Explain capacitor impedance", mode: "teach", revision: 0, processingConsent: true }).expect(200);
  } finally { setTestCompletion(undefined); }
});

test("tutor deletion preserves the resource and rejects stale or foreign requests", async () => {
  const owner = await visitor(), stranger = await visitor(), id = randomUUID();
  await db.insert(bridgeResources).values({ id, visitorId: owner.split("=")[1], resource: {
    courseId: "210", topic: "RC decay", content: "Original explanation", materialIds: [],
    conversation: { revision: 4, turns: [] },
  } });
  const endpoint = `/api/bridge/resources/${id}/conversation`;
  const question = { question: "Explain RC decay", mode: "teach", revision: 4, processingConsent: false };
  for (const method of ["get", "post", "delete"]) {
    await request(app)[method](endpoint).set("Cookie", stranger).set("X-Bridge-Request", "1").send(question).expect(404);
  }
  await request(app).post(endpoint).set("Cookie", owner).set("X-Bridge-Request", "1")
    .send({ ...question, revision: 0 }).expect(409);
  const cleared = await request(app).delete(endpoint).set("Cookie", owner).set("X-Bridge-Request", "1").expect(200);
  assert.deepEqual(cleared.body, { revision: 5, turns: [] });
  const [saved] = await db.select().from(bridgeResources).where(eq(bridgeResources.id, id));
  assert.equal(saved.resource.content, "Original explanation");
  await request(app).post(endpoint).set("Cookie", owner).set("X-Bridge-Request", "1").send(question).expect(409);
  await start(owner, "210");
  for (const mode of ["teach", "guided", "solution", "challenge"]) {
    const blocked = await request(app).post(endpoint).set("Cookie", owner).set("X-Bridge-Request", "1")
      .send({ ...question, revision: 5, mode }).expect(409);
    assert.match(blocked.body.error, /scored check/);
  }
  assert.deepEqual((await get(owner, `resources/${id}/conversation`)), { revision: 5, turns: [] });
});

function tutorCompletion(answer) {
  return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
    answer, supported: false, citations: [],
  }) } }] };
}

async function tutorFixture(count = 19, revision = 39) {
  const cookie = await visitor(), id = randomUUID();
  const turns = Array.from({ length: count }, (_, i) => ({
    question: `Follow-up ${i + 1}: explain the assumptions`,
    mode: "teach", answer: `Synthetic answer ${i + 1}. `.padEnd(15999, "x"),
    supported: false, sources: [], createdAt: "2026-01-01T00:00:00.000Z",
  }));
  const resource = { courseId: "210", topic: "RC decay", content: "Original explanation",
    materialIds: [], sources: [], conversation: { revision, turns } };
  await db.insert(bridgeResources).values({ id, visitorId: cookie.split("=")[1], resource });
  const endpoint = `/api/bridge/resources/${id}/conversation`;
  return {
    resource, cookie, id,
    post: (atRevision = revision) => request(app).post(endpoint).set("Cookie", cookie)
      .set("X-Bridge-Request", "1").send({
        question: "Explain the next step", mode: "teach", revision: atRevision, processingConsent: false,
      }),
    delete: () => request(app).delete(endpoint).set("Cookie", cookie).set("X-Bridge-Request", "1"),
    read: () => get(cookie, `resources/${id}/conversation`),
    saved: async () => (await db.select().from(bridgeResources).where(eq(bridgeResources.id, id)))[0].resource,
  };
}

// Fail missing race barriers promptly; never silently proceed after a sleep.
async function waitForBarrier(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Tutor race barrier was not reached")), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

test("tutor accepts exactly turn 20 with a 16000-character answer and rejects turn 21", async () => {
  const fixture = await tutorFixture();
  const history = fixture.resource.conversation;
  const answer = "Evidence is insufficient. ".padEnd(16000, "x");
  let calls = 0;
  setTestCompletion(async input => {
    calls++;
    assert.deepEqual(input.messages.slice(1, -1), history.turns.flatMap(turn => [
      { role: "user", content: turn.question }, { role: "assistant", content: turn.answer },
    ]), "All 19 long turns reach the provider intact and in order");
    assert.deepEqual(input.messages.at(-1), { role: "user", content: "Explain the next step" });
    return tutorCompletion(answer);
  });
  try {
    const accepted = await fixture.post().expect(200);
    assert.equal(accepted.body.revision, 40);
    assert.equal(accepted.body.turns.length, 20);
    assert.deepEqual(accepted.body.turns.slice(0, 19), history.turns);
    assert.equal(accepted.body.turns[19].answer, labelTutorArithmetic(answer, false));
    assert.ok(accepted.body.turns[19].answer.endsWith(answer), "The full 16000-character provider reply is preserved");
    assert.deepEqual(await fixture.read(), accepted.body);
    const snapshot = { ...fixture.resource, conversation: accepted.body };
    assert.deepEqual(await fixture.saved(), snapshot);
    const rejected = await fixture.post(40).expect(422);
    assert.match(rejected.body.error, /20 follow-ups/);
    assert.equal(calls, 1, "Turn-limit rejection must not invoke the provider");
    assert.deepEqual(await fixture.saved(), snapshot);
  } finally { setTestCompletion(undefined); }
});

test("tutor rejects a 16001-character reply without damaging a near-limit history", async () => {
  const fixture = await tutorFixture();
  let calls = 0;
  setTestCompletion(async () => { calls++; return tutorCompletion("x".repeat(16001)); });
  try {
    const rejected = await fixture.post().expect(502);
    assert.equal(rejected.body.code, "TUTOR_INVALID_RESPONSE");
    assert.equal(calls, 1);
    assert.deepEqual(await fixture.saved(), fixture.resource);
    assert.deepEqual(await fixture.read(), fixture.resource.conversation);
  } finally { setTestCompletion(undefined); }
});

test("deleting 20 long tutor turns advances revision beyond the turn limit and permits a fresh turn", async () => {
  const fixture = await tutorFixture(20, 60);
  let calls = 0;
  setTestCompletion(async input => {
    calls++;
    assert.equal(input.messages.length, 2, "Deleted history must not reach the provider");
    return tutorCompletion("More evidence is needed.");
  });
  try {
    assert.deepEqual(await fixture.read(), fixture.resource.conversation);
    const cleared = await fixture.delete().expect(200);
    assert.deepEqual(cleared.body, { revision: 61, turns: [] });
    assert.deepEqual(await fixture.saved(), { ...fixture.resource, conversation: cleared.body });
    await fixture.post(60).expect(409);
    assert.equal(calls, 0);
    const fresh = await fixture.post(61).expect(200);
    assert.equal(fresh.body.revision, 62);
    assert.equal(fresh.body.turns.length, 1);
    assert.equal(calls, 1);
    assert.deepEqual(await fixture.read(), fresh.body);
    assert.deepEqual(await fixture.saved(), { ...fixture.resource, conversation: fresh.body });
  } finally { setTestCompletion(undefined); }
});

for (const winner of ["delete", "reply"]) {
  test(`concurrent tutor delete/reply preserves the ${winner} winner without stale overwrites`, async () => {
    const fixture = await tutorFixture();
    let entered, release, pendingReply, pendingDelete, calls = 0;
    const providerEntered = new Promise(resolve => { entered = resolve; });
    const providerGate = new Promise(resolve => { release = resolve; });
    setTestCompletion(async () => {
      calls++;
      entered();
      await providerGate;
      return tutorCompletion("Synthetic response".padEnd(16000, "x"));
    });
    try {
      pendingReply = fixture.post().then(response => response);
      await waitForBarrier(providerEntered);
      let expected;
      if (winner === "delete") {
        const deleted = await fixture.delete().expect(200);
        expected = { revision: 40, turns: [] };
        assert.deepEqual(deleted.body, expected);
        release();
        const stale = await pendingReply;
        assert.equal(stale.status, 409);
        assert.match(stale.body.error, /changed or was deleted/);
      } else {
        await holdResourceSnapshot(async ({ ready, release: releaseDelete }) => {
          pendingDelete = fixture.delete().then(response => response);
          await waitForBarrier(ready);
          release();
          const reply = await pendingReply;
          assert.equal(reply.status, 200);
          expected = reply.body;
          assert.equal(expected.revision, 40);
          assert.equal(expected.turns.length, 20);
          assert.deepEqual(expected.turns.slice(0, 19), fixture.resource.conversation.turns);
          releaseDelete();
          const stale = await pendingDelete;
          assert.equal(stale.status, 409);
          assert.match(stale.body.error, /changed.*deleting/);
        });
      }
      assert.equal(calls, 1);
      assert.deepEqual(await fixture.read(), expected);
      assert.deepEqual(await fixture.saved(), { ...fixture.resource, conversation: expected });
    } finally {
      release();
      await Promise.allSettled([pendingReply, pendingDelete].filter(Boolean));
      setTestCompletion(undefined);
    }
  });
}

async function visitor() {
  const id = randomUUID();
  await db.insert(bridgeVisitors).values({
    id, preferences: { savedCourses: [], weeklyHours: 5, goal: "Regression fixture" },
  });
  return `bridge_visitor=${id}`;
}
async function get(cookie, path) {
  const response = await request(app).get(`/api/bridge/${path}`).set("Cookie", cookie).expect(200);
  assert.equal(response.headers["cache-control"], "no-store");
  return response.body;
}
async function start(cookie, courseId, mode = "diagnostic") {
  return (await request(app).post("/api/bridge/assessment").set("Cookie", cookie)
    .set("X-Bridge-Request", "1")
    .send({ courseId, mode }).expect(200)).body;
}
async function row(id) {
  return (await db.select().from(bridgeAssessments).where(eq(bridgeAssessments.id, id)))[0];
}
async function answers(id, correct = true) {
  return (await row(id)).questions.map(q => ({
    questionId: q.id, value: correct ? q.expected : q.expected + 100000,
  }));
}
function submit(cookie, id, values, status = 200) {
  return request(app).post("/api/bridge/assessment/submit").set("Cookie", cookie)
    .set("X-Bridge-Request", "1")
    .send({ assessmentId: id, answers: values }).expect(status);
}
function assertUnassessed(progress) {
  assert.ok(progress.length > 0);
  for (const p of progress) {
    assert.equal(p.total, 0);
    assert.equal(p.correct, 0);
    assert.equal(p.status, "Not assessed");
  }
}

test("legacy rows and omitted course requests remain ECE 210", async () => {
  const cookie = await visitor();
  const id = randomUUID();
  const questions = makeQuestions("210");
  // Pre-expansion insert and stored result omit courseId altogether.
  const result = {
    id, mode: "diagnostic", score: 3, total: 3, createdAt: new Date().toISOString(),
    recommendation: "Legacy fixture",
    feedback: questions.map(q => ({
      concept: q.concept, correct: true, expected: q.expected, submitted: q.expected,
      explanation: q.explanation, lessonId: q.lessonId,
    })),
  };
  await db.insert(bridgeAssessments).values({
    id, visitorId: cookie.split("=")[1], mode: "diagnostic", questions, result,
  });
  assert.equal((await row(id)).courseId, "210");
  const journey = await get(cookie, "journey");
  assert.equal(journey.attempts.length, 1);
  assert.equal(journey.attempts[0].courseId, "210");
  assert.ok(journey.progress.filter(p => p.courseId === "210").every(p => p.total === 1));
  assertUnassessed(journey.progress.filter(p => p.courseId !== "210"));
  assert.equal((await submit(cookie, id, [])).body.courseId, "210");
  const defaultCheck = await start(cookie);
  assert.equal(defaultCheck.courseId, "210");
  assert.equal((await row(defaultCheck.id)).courseId, "210");
});

test("all four courses withhold solutions until submission and isolate course progress", async () => {
  const cookie = await visitor();
  const completed = [];
  for (const courseId of ["110", "120", "210", "220"]) {
    const check = await start(cookie, courseId);
    assert.equal(check.courseId, courseId);
    assert.equal(check.questions.length, 3);
    for (const question of check.questions) {
      assert.deepEqual(Object.keys(question).sort(), ["concept", "hint", "id", "prompt", "unit"]);
    }
    const before = await get(cookie, "journey");
    assert.equal(before.attempts.length, completed.length);
    assertUnassessed(before.progress.filter(p => p.courseId === courseId));
    assert.equal((await get(cookie, "summary")).assessmentCount, completed.length);
    assert.equal((await row(check.id)).result, null);
    const result = (await submit(cookie, check.id, await answers(check.id))).body;
    assert.equal(result.courseId, courseId);
    assert.equal(result.score, 3);
    assert.ok(result.feedback.every(f => f.correct && typeof f.expected === "number" && f.explanation && f.lessonId));
    completed.push(courseId);
    const journey = await get(cookie, "journey");
    assert.deepEqual(journey.attempts.map(a => a.courseId).sort(), [...completed].sort());
    for (const p of journey.progress) {
      assert.equal(p.total, completed.includes(p.courseId) ? 1 : 0);
      assert.equal(p.correct, completed.includes(p.courseId) ? 1 : 0);
    }
    assert.equal((await get(cookie, "summary")).assessmentCount, completed.length);
  }
});

test("visitors cannot submit, see, or overwrite each other's attempts", async () => {
  const owner = await visitor();
  const stranger = await visitor();
  const check = await start(owner, "120");
  const values = await answers(check.id);
  await submit(stranger, check.id, values, 404);
  assert.equal((await row(check.id)).result, null);
  const result = (await submit(owner, check.id, values)).body;
  await submit(stranger, check.id, values, 404);
  const foreignJourney = await get(stranger, "journey");
  assert.deepEqual(foreignJourney.attempts, []);
  assertUnassessed(foreignJourney.progress);
  assert.equal((await get(stranger, "summary")).assessmentCount, 0);
  assert.deepEqual((await get(owner, "journey")).attempts, [result]);
  assert.deepEqual((await row(check.id)).result, result);
});

test("repeated and concurrent submissions persist exactly one immutable result", async () => {
  const cookie = await visitor();
  const check = await start(cookie, "220", "recheck");
  const right = await answers(check.id);
  const wrong = await answers(check.id, false);
  const responses = await raceSubmissions(6, () => Promise.all(
    Array.from({ length: 6 }, (_, i) => submit(cookie, check.id, i % 2 ? wrong : right)),
  ));
  const winner = responses[0].body;
  assert.ok([0, 3].includes(winner.score));
  for (const response of responses) assert.deepEqual(response.body, winner);
  assert.deepEqual((await submit(cookie, check.id, right)).body, winner);
  assert.deepEqual((await submit(cookie, check.id, wrong)).body, winner);
  assert.deepEqual((await row(check.id)).result, winner);
  const journey = await get(cookie, "journey");
  assert.deepEqual(journey.attempts, [winner]);
  assert.ok(journey.progress.filter(p => p.courseId === "220").every(p => p.total === 1));
  assert.equal((await get(cookie, "summary")).assessmentCount, 1);
});

test("unknown, unassessed, and disabled courses are rejected without new attempts", async () => {
  const cookie = await visitor();
  await db.update(bridgePilotCourses).set({ isPilot: false }).where(eq(bridgePilotCourses.courseId, "110"));
  try {
    for (const courseId of ["999", "310", "110"]) {
      await request(app).post("/api/bridge/assessment").set("Cookie", cookie)
        .set("X-Bridge-Request", "1")
        .send({ courseId, mode: "practice" }).expect(400);
    }
    const rows = await db.select().from(bridgeAssessments)
      .where(eq(bridgeAssessments.visitorId, cookie.split("=")[1]));
    assert.deepEqual(rows, []);
    assert.equal((await get(cookie, "summary")).assessmentCount, 0);
  } finally {
    await db.update(bridgePilotCourses).set({ isPilot: true }).where(eq(bridgePilotCourses.courseId, "110"));
  }
});

test("invalid answer sets never save a partial result or expose answers", async () => {
  const cookie = await visitor();
  const check = await start(cookie, "110");
  const values = await answers(check.id);
  for (const invalid of [
    values.slice(1), [values[0], values[0], values[2]],
    values.map(v => ({ ...v, questionId: randomUUID() })),
    values.map(v => ({ ...v, value: null })),
  ]) {
    const response = await submit(cookie, check.id, invalid, 400);
    assert.deepEqual(Object.keys(response.body), ["error"]);
    assert.equal((await row(check.id)).result, null);
  }
  assert.deepEqual((await get(cookie, "journey")).attempts, []);
});
