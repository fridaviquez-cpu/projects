import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { bridgeVisitors } from "./bridge";

export const bridgeVisuals = pgTable("bridge_visuals", {
  id: text("id").primaryKey(),
  visitorId: text("visitor_id").notNull().references(() => bridgeVisitors.id),
  ownerUserId: text("owner_user_id"),
  prompt: text("prompt").notNull(),
  modelVersion: text("model_version").notNull(),
  materialIds: text("material_ids").array().notNull(),
  result: jsonb("result").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertVisualSchema = createInsertSchema(bridgeVisuals).omit({ createdAt: true });
export type SavedVisualRow = typeof bridgeVisuals.$inferSelect;
