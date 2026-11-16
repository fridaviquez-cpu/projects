import { db, pool, usersTable, bridgeAdmins } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const [action, userId] = process.argv.slice(2);
try {
  if (!["grant", "revoke"].includes(action ?? "") || !userId) {
    throw new Error("Usage: admin-role.ts grant|revoke <authenticated-user-id>");
  }
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) throw new Error("The selected user must sign in before a role can be provisioned.");
  if (action === "grant") await db.insert(bridgeAdmins).values({ userId }).onConflictDoNothing();
  else await db.delete(bridgeAdmins).where(eq(bridgeAdmins.userId, userId));
  logger.info({ action }, "Administrator role updated");
} catch (error) {
  logger.error({ message: error instanceof Error ? error.message : "Role update failed" }, "Administrator provisioning failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
