import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
export const bridgeMaterials = pgTable("bridge_materials", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  courseId: text("course_id").notNull(),
  title: text("title").notNull(),
  objectPath: text("object_path").notNull(),
  pages: jsonb("pages").notNull().$type<{page:number;text:string}[]>(),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
export const bridgeFeedback = pgTable("bridge_feedback", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  resourceId: text("resource_id").notNull(),
  courseId: text("course_id").notNull(),
  topic: text("topic").notNull(),
  category: text("category").notNull(),
  comment: text("comment").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
export const bridgeReviewers = pgTable("bridge_reviewers", {
  userId: text("user_id").primaryKey(),
});
