import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { Workspace, Preferences } from "@workspace/api-zod";

export type PortfolioData = Pick<Workspace, "name" | "experience" | "goal" | "holdings" | "theses" | "entries" | "budgetLimits"> & {
  progress: Record<string, { completed: boolean; bookmarked: boolean }>;
  // Optional for workspaces created before the original questionnaire was restored.
  personalization?: Preferences;
  // Only recent import receipts, never source images or base64. Enables safe save retries.
  imageImports?: Array<{ id: string; hash: string; at: number; holdingCount: number; entryCount: number; skippedCount: number }>;
  holdingImports?: Record<string, { fingerprint: string; imported: number; skipped: number }>;
};

export const portfolioWorkspaces = pgTable("piq_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  recoveryHash: text("recovery_hash").unique(),
  data: jsonb("data").$type<PortfolioData>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortfolioWorkspaceSchema = createInsertSchema(portfolioWorkspaces).omit({ id: true, createdAt: true, updatedAt: true });
export type PortfolioWorkspace = typeof portfolioWorkspaces.$inferSelect;
