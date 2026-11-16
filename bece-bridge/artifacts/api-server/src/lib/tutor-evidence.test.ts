import { test } from "node:test";
import assert from "node:assert/strict";
import { assertTutorCitations, materialCitationPrefix, normalizeTutorLabel } from "./tutor-evidence";

const evidence = [{ label: "M1-P2-S1", url: "/materials/a#page-2" }];
test("bracket normalization permits equivalent syntax, never unreturned sources", () => {
  assert.equal(normalizeTutorLabel(" [M1-P2-S1] "), "M1-P2-S1");
  assert.equal(normalizeTutorLabel("M1-P2-S1"), "M1-P2-S1");
  assert.doesNotThrow(() => assertTutorCitations({ answer: "[M1-P2-S1]", supported: true, citations: [normalizeTutorLabel("[M1-P2-S1]")] }, evidence));
  assert.throws(() => assertTutorCitations({ answer: "[M9-P2-S1]", supported: true, citations: [normalizeTutorLabel("[M9-P2-S1]")] }, evidence));
});
test("supported answers require both cited text and actual retrieved evidence", () => {
  assert.doesNotThrow(() => assertTutorCitations({ answer: "By KCL [M1-P2-S1].", supported: true, citations: ["M1-P2-S1"] }, evidence));
  for (const answer of ["No citation", "[M8-P9-S1]", "[M1-P2-S1] [B2]"]) {
    assert.throws(() => assertTutorCitations({ answer, supported: true, citations: ["M1-P2-S1"] }, evidence));
  }
});
test("insufficient evidence must not invent a supporting citation", () => {
  assert.doesNotThrow(() => assertTutorCitations({ answer: "This source does not discuss quantum mechanics.", supported: false, citations: [] }, evidence));
  assert.throws(() => assertTutorCitations({ answer: "Missing [M1-P2-S1]", supported: false, citations: [] }, evidence));
  assert.throws(() => assertTutorCitations({ answer: "Missing", supported: false, citations: ["M1-P2-S1"] }, evidence));
});
test("reject fabricated source links even when valid labels also appear", () => {
  assert.throws(() => assertTutorCitations({ answer: "[M1-P2-S1] [source](https://fabricated.test)", supported: true, citations: ["M1-P2-S1"] }, evidence));
});
test("newly retrieved documents do not reuse previous material labels", () => {
  const sources = [{ kind: "Private [M1-P2-S1]", url: "/materials/a#page-2" }];
  assert.equal(materialCitationPrefix("a", ["b", "a"], sources), "M1");
  assert.equal(materialCitationPrefix("b", ["b", "a"], sources), "M2");
});
test("shared-evidence stable material IDs survive normalization and follow-ups", () => {
  const id = "12345678-abcd-4321-abcd-123456789abc";
  const label = `M${id}-P3-S2`;
  const sources = [{ kind: `Private [${label}]`, url: `/materials/${id}#page-3` }];
  assert.equal(materialCitationPrefix(id, [id], sources), `M${id}`);
  assert.equal(normalizeTutorLabel(`[${label}]`), label);
  assert.doesNotThrow(() => assertTutorCitations({
    answer: `A derivation [${label}].`, supported: true, citations: [label],
  }, [{ label, url: sources[0]!.url }]));
});
test("grouped and shared-source citations remain membership checked", () => {
  const allowed = [...evidence, { label: "S-example", url: "https://example.org" }];
  assert.doesNotThrow(() => assertTutorCitations({ answer: "[M1-P2-S1; S-example]", supported: true, citations: ["M1-P2-S1", "S-example"] }, allowed));
  for (const answer of ["[M1-P2-S1, invented]", "[M1-P2-S1; S-unknown]"]) {
    assert.throws(() => assertTutorCitations({ answer, supported: true, citations: ["M1-P2-S1"] }, allowed));
  }
});
