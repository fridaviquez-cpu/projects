import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createServer, type ViteDevServer } from "vite";

type Site = { url: string; restartApi: () => Promise<void>; expireSession: (token: string) => Promise<void> };
const root = fileURLToPath(new URL("../../../", import.meta.url));

export const test = base.extend<{}, { site: Site }>({
  site: [async ({}, use) => {
    // No queries, copies, migrations or deletes against public tables.
    // Both the schema and all browser contexts are disposable for each run.
    const schema = `piq_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    let child: ChildProcess | undefined;
    let vite: ViteDevServer | undefined;
    let port = 0;
    let childErrors = "";
    const stop = async () => {
      if (!child || child.exitCode !== null) return;
      const exited = once(child, "exit");
      child.send("stop");
      const timer = setTimeout(() => child?.kill("SIGKILL"), 5000);
      try { await exited; } finally { clearTimeout(timer); }
    };
    const start = async () => {
      childErrors = "";
      child = fork(`${root}artifacts/api-server/tests/guest-server.ts`, [], {
        cwd: `${root}artifacts/api-server`,
        execArgv: ["--import", "tsx"],
        env: {
          ...process.env, NODE_ENV: "test", PGOPTIONS: `-c search_path=${schema}`,
          PIQ_TEST_SCHEMA: schema, PIQ_TEST_PORT: String(port),
        },
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      child.stderr?.on("data", (chunk: Buffer) => { childErrors += chunk.toString(); });
      const running = child;
      port = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => { running.kill("SIGKILL"); reject(new Error("Test API startup timed out")); }, 30_000);
        running.once("message", (message: { port: number }) => { clearTimeout(timer); resolve(message.port); });
        running.once("error", (err) => { clearTimeout(timer); reject(err); });
        running.once("exit", (code) => {
          clearTimeout(timer);
          // Do not print child logs or environment values: they can contain connection details.
          reject(new Error(`Test API exited during startup (${code}); check database and disposable-schema permissions. ${childErrors.includes("isolated schema") ? "Schema guard rejected the connection." : ""}`));
        });
      });
    };
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`
        CREATE TABLE "${schema}".piq_workspaces (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          recovery_hash text UNIQUE,
          data jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE "${schema}".piq_sessions (
          token_hash text PRIMARY KEY,
          workspace_id uuid NOT NULL REFERENCES "${schema}".piq_workspaces(id) ON DELETE CASCADE,
          expires_at timestamptz NOT NULL
        );
      `);
      await start();
      // Test-only origin routes /api to the disposable process. Production and
      // managed preview routing are unchanged. Use the real frontend Vite config.
      const oldPort = process.env.PORT;
      const oldBase = process.env.BASE_PATH;
      process.env.PORT = "5173";
      process.env.BASE_PATH = "/";
      try {
        vite = await createServer({
          configFile: `${root}artifacts/portfolio-iq/vite.config.ts`,
          mode: "test",
          server: {
            port: 0, host: "127.0.0.1", strictPort: false,
            // Object form: Vite's string shorthand forces changeOrigin:true, which rewrites
            // Host to the API port and trips the app's same-origin guard. Preserve Host so
            // the browser's Origin matches, as a same-origin reverse proxy would.
            proxy: { "/api": { target: `http://127.0.0.1:${port}`, changeOrigin: false } },
          },
        });
      } finally {
        if (oldPort === undefined) delete process.env.PORT; else process.env.PORT = oldPort;
        if (oldBase === undefined) delete process.env.BASE_PATH; else process.env.BASE_PATH = oldBase;
      }
      await vite.listen();
      const address = vite.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("Test frontend did not bind.");
      await use({
        url: `http://127.0.0.1:${address.port}`,
        restartApi: async () => { await stop(); await start(); },
        expireSession: async (token) => {
          await admin.query(`UPDATE "${schema}".piq_sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
            [createHash("sha256").update(token).digest("hex")]);
        },
      });
    } finally {
      await vite?.close();
      await stop();
      // schema was generated internally and validated again to keep DROP narrowly scoped.
      if (/^piq_test_[a-f0-9]{32}$/.test(schema)) await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  }, { scope: "worker", timeout: 90_000 }],
});
export { expect };
