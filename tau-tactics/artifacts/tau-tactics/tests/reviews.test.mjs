import { test } from "node:test";
import assert from "node:assert/strict";
import { mutateReview, readReviews, reviewKey, validReviewDate, buildReviewPrompt, localDate } from "../src/lib/reviews.ts";
import { readReviewDraft, writeReviewDraft } from "../src/lib/review-drafts.ts";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, v); }
  removeItem(k) { this.values.delete(k); }
}
const session = { id: "old-session", task: "Private task", minutes: 25, completedAt: 123, reflection: { recalled: false, practiced: false, takeaway: "Private takeaway", unclear: "Voltage signs" } };
const setup = () => {
  const storage = new MemoryStorage();
  storage.setItem("tau.sessions.v1", JSON.stringify([session]));
  return storage;
};
const create = (storage, overrides = {}) => mutateReview(storage, { kind: "create", sessionId: session.id, topic: "Voltage signs", date: "2026-11-07", ...overrides });
const itemFrom = (result) => { assert.equal(result.ok, true, result.error); assert.ok(result.item); return result.item; };

test("legacy session: create, reload, retrieve, choose next action, reschedule and delete", () => {
  const storage = setup();
  const source = storage.getItem("tau.sessions.v1");
  let item = itemFrom(create(storage));
  assert.equal(readReviews(storage).items[0].sessionId, session.id);
  item = itemFrom(mutateReview(storage, { kind: "update", item, patch: { attempt: "I mix up the signs.", feedbackUnlocked: true } }));
  item = itemFrom(mutateReview(storage, { kind: "update", item, patch: { nextAction: "revisit", reviewedAt: 456, date: "2026-11-10" } }));
  assert.equal(readReviews(storage).items[0].date, "2026-11-10");
  assert.equal(readReviews(storage).items[0].attempt, "I mix up the signs.");
  assert.equal(mutateReview(storage, { kind: "delete", item }).ok, true);
  assert.deepEqual(readReviews(storage), { items: [], error: null });
  assert.equal(storage.getItem("tau.sessions.v1"), source, "reviews never change history or Leo credit");
});

test("repeated creation cannot duplicate or replace work", () => {
  const storage = setup();
  const first = itemFrom(create(storage));
  const repeated = itemFrom(create(storage, { topic: "different", date: "" }));
  assert.deepEqual(first, repeated);
  assert.equal(readReviews(storage).items.length, 1);
});

test("no invented topic for missing, blank or older reflections", () => {
  for (const reflection of [undefined, {}, { unclear: "" }, { unclear: "  " }]) {
    const storage = setup();
    storage.setItem("tau.sessions.v1", JSON.stringify([{ ...session, reflection }]));
    assert.equal(create(storage).ok, false);
    assert.equal(readReviews(storage).items.length, 0);
  }
  assert.equal(create(setup(), { topic: " " }).ok, false);
  assert.equal(create(setup(), { sessionId: "missing" }).ok, false);
});

test("dates are optional, local-calendar based, and never penalize late review", () => {
  assert.equal(validReviewDate(""), true);
  assert.equal(validReviewDate("2026-02-30"), false);
  assert.equal(validReviewDate("2028-02-29"), true);
  assert.equal(validReviewDate("invalid"), false);
  assert.equal(localDate(new Date(2026, 10, 7, 23, 59)), "2026-11-07");
  assert.equal(create(setup(), { date: "" }).ok, true);
  assert.equal(create(setup(), { date: "2001-01-01" }).ok, true);
});

test("feedback requires an attempt and topic edits start fresh retrieval", () => {
  const storage = setup();
  let item = itemFrom(create(storage));
  assert.equal(mutateReview(storage, { kind: "update", item, patch: { feedbackUnlocked: true } }).ok, false);
  item = itemFrom(mutateReview(storage, { kind: "update", item, patch: { feedbackUnlocked: true, attempt: "I cannot explain it yet", promptDraft: "old prompt", nextAction: "example", reviewedAt: 123 } }));
  item = itemFrom(mutateReview(storage, { kind: "update", item, patch: { topic: "Kirchhoff loops" } }));
  assert.equal(item.feedbackUnlocked, false);
  assert.equal(item.attempt, "");
  assert.equal(item.promptDraft, undefined);
  assert.equal(item.reviewedAt, undefined);
});

test("stale tabs cannot overwrite or resurrect deleted items", () => {
  const storage = setup();
  const old = itemFrom(create(storage));
  const current = itemFrom(mutateReview(storage, { kind: "update", item: old, patch: { date: "" } }));
  assert.equal(mutateReview(storage, { kind: "update", item: old, patch: { topic: "stale" } }).ok, false);
  assert.equal(mutateReview(storage, { kind: "delete", item: old }).ok, false);
  assert.equal(mutateReview(storage, { kind: "delete", item: current }).ok, true);
  assert.equal(mutateReview(storage, { kind: "update", item: current, patch: { date: "" } }).ok, false);
});

test("blocked/quota writes never return success or alter saved review", () => {
  const storage = setup();
  const item = itemFrom(create(storage));
  const original = storage.getItem(reviewKey(item.id));
  storage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  assert.equal(mutateReview(storage, { kind: "update", item, patch: { date: "" } }).ok, false);
  assert.equal(storage.getItem(reviewKey(item.id)), original);
  storage.removeItem = () => { throw new DOMException("blocked", "SecurityError"); };
  assert.equal(mutateReview(storage, { kind: "delete", item }).ok, false);
});

test("malformed review data stays unchanged and valid items remain accessible", () => {
  const storage = setup();
  create(storage);
  storage.setItem(reviewKey("bad"), "{bad json");
  const result = readReviews(storage);
  assert.equal(result.items.length, 1);
  assert.ok(result.error);
  assert.equal(storage.getItem(reviewKey("bad")), "{bad json");
  assert.equal(create(storage, { sessionId: "bad" }).ok, false);
  assert.equal(storage.getItem(reviewKey("bad")), "{bad json");
});

test("review survives source deletion as an independent explicitly saved item", () => {
  const storage = setup();
  const item = itemFrom(create(storage));
  storage.setItem("tau.sessions.v1", "[]");
  assert.equal(readReviews(storage).items.length, 1);
  assert.equal(mutateReview(storage, { kind: "delete", item }).ok, true);
});

test("AI prompt includes only chosen topic and attempt, with hints and verification", () => {
  const item = itemFrom(create(setup()));
  const prompt = buildReviewPrompt({ ...item, attempt: "My own attempt", task: "Private task", takeaway: "Private takeaway" });
  assert.match(prompt, /Voltage signs/);
  assert.match(prompt, /My own attempt/);
  assert.doesNotMatch(prompt, /Private/);
  assert.match(prompt, /one small hint before any solution/);
  assert.match(prompt, /verify feedback against my permitted course materials/);
  assert.match(prompt, /do not complete it/);
});

test("unavailable reads report failure rather than pretending there are no saved reviews", () => {
  const storage = { get length() { throw new DOMException("blocked", "SecurityError"); } };
  assert.ok(readReviews(storage).error);
});

test("tab-local drafts recover after navigation and clear explicitly", () => {
  globalThis.sessionStorage = new MemoryStorage();
  const draft = { revision: "draft-r1", editing: false, topic: "KVL", date: "", attempt: "Partial explanation", prompt: "", nextDate: "" };
  assert.equal(writeReviewDraft("draft-test", draft), true);
  assert.deepEqual(readReviewDraft("draft-test"), draft);
  assert.equal(JSON.parse(sessionStorage.getItem("tau.review-draft.v1:draft-test")).attempt, draft.attempt);
  assert.equal(writeReviewDraft("draft-test", null), true);
  assert.equal(readReviewDraft("draft-test"), null);
  sessionStorage.setItem = () => { throw new DOMException("blocked", "SecurityError"); };
  assert.equal(writeReviewDraft("blocked-draft", draft), false);
  assert.deepEqual(readReviewDraft("blocked-draft"), draft, "memory recovery remains available when tab storage is blocked");
  delete globalThis.sessionStorage;
});
