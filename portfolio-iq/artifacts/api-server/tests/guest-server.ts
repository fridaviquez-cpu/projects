// Test-only entrypoint: never start unless the database search path is disposable.
// Import the application only AFTER verifying the connection's actual schema.
import { pool } from "@workspace/db";

const schema = process.env.PIQ_TEST_SCHEMA;
if (!schema || !/^piq_test_[a-f0-9]{32}$/.test(schema)) {
  throw new Error("A disposable test schema is required.");
}
const { rows } = await pool.query("select current_schema() as schema");
if (rows[0]?.schema !== schema) {
  throw new Error("Refusing to run guest tests outside their isolated schema.");
}

const { default: app } = await import("../src/app");
const server = app.listen(Number(process.env.PIQ_TEST_PORT ?? 0), "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test API did not bind.");
  process.send?.({ port: address.port });
});
process.on("message", async (message) => {
  if (message === "stop") {
    server.closeAllConnections();
    server.close(async () => { await pool.end(); process.exit(0); });
  }
});
process.on("disconnect", () => { server.closeAllConnections(); server.close(); void pool.end(); });
