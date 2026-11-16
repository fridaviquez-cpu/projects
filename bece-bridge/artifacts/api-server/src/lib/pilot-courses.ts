import { db, bridgePilotCourses } from "@workspace/db";
import { courses, lessons } from "./bridge-learning";
import { withPilotMembership } from "./pilot-membership";
export const PILOT_IDS = ["110", "120", "210", "220", "310", "313", "329", "330", "333", "340", "342"];

// Seed membership only; never overwrite an existing owner's configuration.
export async function seedPilotCourses() {
  await db.insert(bridgePilotCourses).values(
    PILOT_IDS.map(courseId => ({ courseId, isPilot: true })),
  ).onConflictDoNothing();
}

export async function configuredCourses() {
  const records = await db.select().from(bridgePilotCourses);
  return withPilotMembership(courses, records).map(course => ({
    ...course,
    assessedConcepts: lessons.filter(l=>l.courseId===course.id).map(l=>l.concept),
    instructionalCoverage: ["110","120","210","220"].includes(course.id)
      ? "Partial: licensed shared selections, three original lessons and numeric checks; gaps use general AI or your uploads."
      : course.isPilot
        ? "Partial: verified topic scope and AI drafts; upload your permitted lectures for instructional grounding. No scored diagnostics yet."
        : "Catalog metadata only; learning tools not enabled.",
  }));
}
