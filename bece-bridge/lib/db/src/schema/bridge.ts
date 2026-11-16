import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
export const bridgeVisitors = pgTable("bridge_visitors", {
  id: text("id").primaryKey(),
  preferences: jsonb("preferences").notNull().$type<{savedCourses:string[];weeklyHours:number;goal:string}>(),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
export const bridgeAssessments = pgTable("bridge_assessments", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().default("210"),
  visitorId: text("visitor_id").notNull().references(()=>bridgeVisitors.id),
  mode: text("mode").notNull(),
  questions: jsonb("questions").notNull().$type<unknown[]>(),
  result: jsonb("result").$type<Record<string,unknown>>(),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
export const bridgeResources = pgTable("bridge_resources", {
  ownerUserId: text("owner_user_id"),
  id: text("id").primaryKey(),
  visitorId: text("visitor_id").notNull().references(()=>bridgeVisitors.id),
  resource: jsonb("resource").notNull().$type<Record<string,unknown>>(),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
