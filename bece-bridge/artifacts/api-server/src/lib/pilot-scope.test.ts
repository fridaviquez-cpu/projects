import assert from "node:assert/strict";
import { courseScopeContext } from "./course-scope";
import { courses } from "./bridge-learning";

for (const [id, expected] of [
  ["110", "Photovoltaics"], ["120", "Finite state machines"],
  ["210", "Fourier transform"], ["220", "Dynamic memory allocation"],
]) {
  const scope = courseScopeContext(id!);
  assert.ok(scope.topics.includes(expected!), `${id} major topic`);
  assert.ok(scope.sources.some(s=>s.url.endsWith(`/ece${id}`)));
  assert.ok(scope.sources.some(s=>s.url.includes(`ece${id}/`) && s.url.includes("hkn")));
  assert.equal(courses.find(c=>c.id===id)?.topics.length, scope.topics.length);
  if (id !== "210") {
    assert.ok(!scope.knowledgeCoverage.some(t=>t.startsWith("Original")), "Do not misrepresent 210 lessons as this course's instruction");
    assert.ok(!scope.sources.some(s=>/ece210/i.test(s.url)), "No ECE210 source leakage");
  }
}
console.log("Four-course scope, provenance, and instructional isolation checks passed.");
