import assert from "node:assert/strict";
import { courseScopeContext, courseScopeRegistry, scopePolicy } from "./course-scope";
import { courses, makeQuestions } from "./bridge-learning";

assert.equal(courseScopeRegistry.length, courses.length);
const scope = courseScopeContext("210");
for (const topic of ["Fourier series", "Fourier transform", "Laplace transform", "Convolution", "Frequency response", "Complex numbers"]) {
  assert.ok(scope.topics.some(t => t.toLowerCase().includes(topic.toLowerCase())), topic);
}
assert.equal(scope.unlistedTopicStatus, "unknown");
assert.equal(scope.knowledgeCoverage.filter(t=>t.startsWith("Original")).length, 3);
assert.equal(scope.coverageStatus, "Partially Supported");
assert.ok(scope.sources.some(s => s.url === "https://ece.illinois.edu/academics/courses/ece210"));
assert.ok(scopePolicy.includes("no course lecture retrieved"));
assert.throws(() => courseScopeContext("not-a-course"));
for (const course of courseScopeRegistry.filter(c => c.courseId !== "210")) {
  assert.equal(course.unlistedTopicStatus, "unknown");
  assert.ok(!course.knowledgeCoverage.some(t=>t.startsWith("Original")), "No ECE210 lesson leakage");
}
for (let i = 0; i < 100; i++) {
  const questions = makeQuestions();
  assert.equal(new Set(questions.map(q => q.id)).size, 3);
  assert.ok(questions.every(q => Number.isFinite(q.expected) && q.expected > 0));
}
console.log("PASS: catalog scope registry, six ECE210 topics, unknown semantics, coverage separation, assessment generation sanity.");
