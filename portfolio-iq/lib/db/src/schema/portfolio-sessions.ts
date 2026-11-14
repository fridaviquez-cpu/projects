import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { portfolioWorkspaces } from "./portfolio-workspaces";

export const portfolioSessions = pgTable("piq_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => portfolioWorkspaces.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [index("piq_sessions_workspace_idx").on(table.workspaceId)]);

export const insertPortfolioSessionSchema = createInsertSchema(portfolioSessions);
