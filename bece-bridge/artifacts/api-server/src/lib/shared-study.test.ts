import assert from "node:assert/strict";
import { courseStudy, retrieveSharedStudy, validateEvidenceCitations, sharedAttribution } from "./shared-study";
import { courseScopeContext } from "./course-scope";

// Retrieval/provenance checks are intentionally independent of factual benchmarks.
for (const [course, query, expected] of [
  ["110", "Explain Ohm's law for a resistor", "ohm"],
  ["120", "Explain XOR truth table", "gates"],
  ["120", "De Morgan NAND", "demorgan"],
  ["210", "capacitor impedance", "impedance"],
  ["210", "phasor multiplication", "phasor"],
  ["220", "pointer dereferencing", "pointers"],
  ["220", "malloc allocation", "allocation"],
]) {
  const hits = retrieveSharedStudy(course!, query!);
  assert.ok(hits.some(s=>s.id===expected));
  assert.ok(hits.every(s=>s.courses.includes(course!)));
  for (const other of ["110","120","210","220"].filter(c=>c!==course)) {
    assert.ok(!retrieveSharedStudy(other, query!).some(s=>s.id===expected), "Cross-course leak");
  }
}
for (const id of ["110","120","210","220"]) {
  const entries = courseStudy(id);
  assert.ok(entries.length);
  for (const s of entries) {
    assert.equal(s.license, "CC BY-SA 4.0");
    assert.match(s.revisionUrl, /oldid=\d+/);
    assert.ok(s.locator.includes("unpaginated"));
    assert.ok(s.text.length > 100);
    assert.ok(s.topics.every(t=>courseScopeContext(id).topics.includes(t)));
  }
  for (const query of ["", "help me study", "quantum gravity", "and or not", "LC-3 calling conventions", "Fourier transform"]) {
    assert.deepEqual(retrieveSharedStudy(id, query), [], `Do not fill gaps: ${id} ${query}`);
  }
}
assert.deepEqual(courseStudy("999"), []);
const evidence = retrieveSharedStudy("110", "ohm");
assert.throws(()=>validateEvidenceCitations("no evidence", evidence));
assert.throws(()=>validateEvidenceCitations("[S-invented]", evidence));
assert.throws(()=>validateEvidenceCitations("[S-ohm] [M1-P1-S1]", evidence));
assert.ok(validateEvidenceCitations("[S-ohm]", evidence).has("S-ohm"));
const stablePrivate = {label:"Mabc-123-def-P2-S1"};
assert.ok(validateEvidenceCitations(`[${stablePrivate.label}]`, [stablePrivate]).has(stablePrivate.label));
assert.throws(()=>validateEvidenceCitations("[Mabc-123-def-P2-S1]", evidence));
assert.throws(()=>validateEvidenceCitations("[S-ohm] [Mabc-123-def-P2-S1]", evidence));
assert.match(sharedAttribution(evidence), /CC BY-SA 4.0/);
assert.match(sharedAttribution(evidence), /oldid=3142530/);
console.log("PASS: course isolation, relevant retrieval, gap abstention, provenance and citation validation.");
