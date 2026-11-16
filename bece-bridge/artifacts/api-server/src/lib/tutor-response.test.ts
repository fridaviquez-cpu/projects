import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { tutorReplySchema, tutorFailure } from "./tutor-response";
import { assertTutorCitations } from "./tutor-evidence";

const evidence = [{ label: "M1-P1-S1", url: "/materials/test#page-1" }];
const derivation = "Exponentiation is the inverse of the natural logarithm: $\\ln(v/V_0)=-t/(RC)$ implies $v=V_0e^{-t/(RC)}$. [M1-P1-S1]";
test("reproduce the original citation contract defect without relying on an AI call", () => {
  const raw = { answer: derivation, supported: true, citations: ["[M1-P1-S1]"] };
  // The original validator compared display labels directly with bare evidence IDs.
  assert.throws(() => assertTutorCitations(raw, evidence), /Invalid citation/);
  const decoded = JSON.parse(JSON.stringify(raw));
  const validated = tutorReplySchema.parse(decoded);
  assert.doesNotThrow(() => assertTutorCitations(validated, evidence));
  assert.equal(validated.answer, derivation); // No changes to math or explanation.
  assert.deepEqual(validated.citations, ["M1-P1-S1"]);
});
test("optional null visual prompt is not a malformed mathematical answer", () => {
  const legacyOptionalField = z.object({ visualPrompt: z.string().max(1100).optional() });
  assert.equal(legacyOptionalField.safeParse({ visualPrompt: null }).success, false);
  const validated = tutorReplySchema.parse({ answer: derivation, supported: true, citations: ["M1-P1-S1"], visualPrompt: null });
  assert.equal(validated.visualPrompt, undefined);
  assert.doesNotThrow(() => assertTutorCitations(validated, evidence));
});
test("normalization does not admit invented sources", () => {
  const validated = tutorReplySchema.parse({ answer: derivation, supported: true, citations: ["[M99-P8-S1]"] });
  assert.throws(() => assertTutorCitations(validated, evidence));
});
test("classify JSON, provider and storage failures separately without leaking payloads", () => {
  const secretText = "PRIVATE_SYNTHETIC_LECTURE_CONTENT";
  assert.equal(tutorFailure("decode", new SyntaxError(secretText)).code, "TUTOR_INVALID_JSON");
  assert.equal(tutorFailure("persist", new Error(secretText)).status, 500);
  assert.equal(tutorFailure("provider", { status: 429, message: secretText }).providerStatus, 429);
  for (const stage of ["provider", "persist", "decode"] as const) {
    assert.equal(JSON.stringify(tutorFailure(stage, new Error(secretText))).includes(secretText), false);
  }
});
test("schema diagnostics name only fields and error codes, not submitted content", () => {
  const parsed = tutorReplySchema.safeParse({ answer: { privateText: "DO_NOT_LOG_ME" } });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const failure = tutorFailure("shape", parsed.error);
    assert.ok(failure.shapeIssues?.some(issue => issue.path === "answer"));
    assert.equal(JSON.stringify(failure).includes("DO_NOT_LOG_ME"), false);
  }
});
