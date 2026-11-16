import { pgTable, text, boolean } from "drizzle-orm/pg-core";

export const bridgePilotCourses = pgTable("bridge_pilot_courses", {
  courseId: text("course_id").primaryKey(),
  isPilot: boolean("is_pilot").notNull().default(true),
});
