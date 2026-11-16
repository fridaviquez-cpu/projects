import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { bridgeVisitors } from "./bridge";
import { usersTable } from "./auth";

// Roles are provisioned by an operator, never by a public HTTP endpoint.
export const bridgeAdmins = pgTable("bridge_admins", {
  userId: text("user_id").primaryKey().references(() => usersTable.id),
});
export const bridgeReports = pgTable("bridge_reports", {
  id: text("id").primaryKey(),
  visitorId: text("visitor_id").notNull().references(() => bridgeVisitors.id),
  ownerUserId: text("owner_user_id").references(() => usersTable.id),
  // Intentionally not a resource FK: deleting a resource must not erase its report.
  resourceId: text("resource_id").notNull(),
  generationId: text("generation_id").notNull(),
  courseId: text("course_id").notNull(),
  topic: text("topic").notNull(),
  resourceTitle: text("resource_title").notNull(),
  category: text("category").notNull(),
  details: text("details").notNull(),
  status: text("status").notNull().default("open"),
  reviewNote: text("review_note").notNull().default(""),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const bridgeReportReviews = pgTable("bridge_report_reviews", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => bridgeReports.id),
  reviewerId: text("reviewer_id").notNull().references(() => usersTable.id),
  change: jsonb("change").notNull().$type<{status:string;reviewNote:string;version:number}>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
// Persistent fixed-window buckets enforce limits across processes and restarts.
export const bridgeRateBuckets = pgTable("bridge_rate_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const bridgeGenerationUsage = pgTable("bridge_generation_usage", {
  visitorId: text("visitor_id").primaryKey().references(() => bridgeVisitors.id),
  day: text("day").notNull(),
  count: integer("count").notNull().default(0),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  leaseId: text("lease_id"),
});
