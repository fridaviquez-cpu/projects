import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

await mkdir("dist/tests", { recursive: true });
await build({
  entryPoints: ["tests/bridge.test.mjs"],
  outfile: "dist/tests/bridge.test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  alias: {
    "drizzle-zod": resolve("../../lib/db/node_modules/drizzle-zod/index.mjs"),
    "zod": resolve("../../lib/api-zod/node_modules/zod"),
    "@workspace/db": resolve("tests/database.mjs"),
    "@workspace/api-zod": resolve("../../lib/api-zod/src/index.ts"),
    "@workspace/integrations-openai-ai-server": resolve("tests/no-ai.mjs"),
  },
});
// Keep independent journeys in separate isolated-schema processes. Together
// their synthetic writes exceed the real 60/minute network guard; neither
// suite should disable that guard or reset a shared quota to make tests pass.
const persistenceCase = "^non-AI saved fixtures";
for (const filter of [`--test-skip-pattern=${persistenceCase}`, `--test-name-pattern=${persistenceCase}`]) {
  const result = spawnSync(process.execPath, ["--test", filter, "dist/tests/bridge.test.mjs"], {
    stdio: "inherit",
    // Ephemeral test-process value only; never use or change the app's secret.
    env: { ...process.env, NODE_ENV: "test", SESSION_SECRET: randomUUID() },
  });
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
