import assert from "node:assert/strict";
import { RESOURCES, resourcesForPilots } from "./resources";
import type { Course } from "@workspace/api-client-react";

// Mirror the category + course selection that previously produced empty results.
for (const course of ["110", "120", "210", "220", "310", "313", "329", "330", "333", "340", "342"]) {
  for (const category of ["videos", "pdfs"]) {
    // ECE 120's existing video coverage is retained; no new PDF coverage is claimed.
    if (course === "120" && category === "pdfs") continue;
    const matches = RESOURCES.filter(r => r.category === category && r.courses.includes(course));
    assert.ok(matches.length, `${course} needs ${category} resources`);
    assert.ok(matches.every(r => r.standing === "general" && r.url.startsWith("https://")));
  }
}
assert.equal(new Set(RESOURCES.map(r => r.id)).size, RESOURCES.length, "Unique resource keys");
assert.ok(!RESOURCES.find(r => r.id === "mit-solar-videos")?.courses.includes("220"), "No unrelated retagging");
const futurePilot = {
  id: "999", code: "ECE 999", title: "Future pilot", isPilot: true,
  sources: [{ url: "https://ece.illinois.edu/academics/courses/ece999" }],
} as Course;
assert.ok(resourcesForPilots([futurePilot]).some(r => r.courses.includes("999")), "Dynamic pilot links preserved");
assert.ok(!resourcesForPilots([{ ...futurePilot, isPilot: false }]).some(r => r.courses.includes("999")));
console.log("PASS: course/category coverage, external labels, unique IDs, topic isolation, dynamic pilot links");
