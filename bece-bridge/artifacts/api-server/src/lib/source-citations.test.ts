import assert from "node:assert/strict";
import { citationFailureDiagnostics, CitationValidationError, validateSourceCitations } from "./source-citations";

const labels = ["M1-P2-S1", "M2-P14-S3"];
for (const input of [
  "A derivation [M1-P2-S1]. An example [M2-P14-S3].",
  "A derivation [M1-P2-S1, M2-P14-S3].",
  "An example [ M1-P2-S1 ; M2-P14-S3 ].",
]) {
  const result = validateSourceCitations(input, labels);
  assert.deepEqual(result.cited, labels);
  assert.ok(result.content.includes("[M1-P2-S1]"));
  assert.ok(result.content.includes("[M2-P14-S3]"));
}
assert.deepEqual(validateSourceCitations("[M1-P2-S1] [M1-P2-S1]", labels).cited, [labels[0]]);
for (const input of [
  "[M1-P2-S1, M2-P999-S3]",
  "[M1-P2-S1] [M9-P1-S1, M8-P1-S1]",
  "[M1-P2-S1; invented]",
  "[M1-P2-S1,]",
  "[M1-P2-S1–M2-P14-S3]",
  "[m1-p2-s1]",
]) {
  assert.throws(() => validateSourceCitations(input, labels),
    (error: unknown) => error instanceof CitationValidationError && error.code === "invalid_citations");
}
assert.throws(() => validateSourceCitations("No supporting evidence.", labels),
  (error: unknown) => error instanceof CitationValidationError && error.code === "missing_citations");
assert.throws(() => validateSourceCitations("[M1-P2-S1]", ["M2-P14-S3"]));
const math = "x[n] = [1, 2]; [reference](https://example.org) [M1-P2-S1]";
assert.equal(validateSourceCitations(math, labels).content, math);
const sharedLabels = ["M12345678-abcd-4321-abcd-123456789abc-P1-S1", "S-circuit-kcl"];
assert.deepEqual(validateSourceCitations(`[${sharedLabels.join(", ")}]`, sharedLabels).cited, sharedLabels);
assert.throws(() => validateSourceCitations("[S-unknown]", sharedLabels));
// An upstream exception may contain private student text; never serialize it.
assert.deepEqual(citationFailureDiagnostics(new Error("PRIVATE STUDENT EXCERPT")), { failureCode: "generation_failed" });
assert.deepEqual(citationFailureDiagnostics(new CitationValidationError("invalid_citations", 1, 2)),
  { failureCode: "invalid_citations", citationCount: 1, invalidCitationCount: 2 });
console.log("PASS: individual/grouped citations, invalid membership and syntax, math preservation, privacy-safe diagnostics");
