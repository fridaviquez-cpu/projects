import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { request } from "node:http";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { createServer } from "node:net";

// Exercise the actual production bundle in an isolated process, not the preview.
// A vulnerable parser can throw asynchronously after sending a response.
test("production API survives malformed compressed JSON and form requests", { timeout: 20000 }, async () => {
  const require = createRequire(import.meta.url);
  const expressRequire = createRequire(require.resolve("express"));
  const version = expressRequire("body-parser/package.json").version;
  const [major, minor] = version.split(".").map(Number);
  assert.ok(major > 2 || (major === 2 && minor >= 4), `Unpatched parser ${version}`);
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stderr.on("data", chunk => { logs += chunk; });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Startup timed out: ${logs}`)), 8000);
      child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Exited ${code}: ${logs}`)); });
      child.stdout.on("data", chunk => {
        logs += chunk;
        if (logs.includes("Server listening")) { clearTimeout(timeout); resolve(); }
      });
    });
    const send = (body, type) => new Promise((resolve, reject) => {
      const req = request({ hostname: "127.0.0.1", port, path: "/api/healthz", method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": type, "Content-Encoding": "gzip", "Content-Length": body.length } : {} },
      res => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
      req.on("error", reject);
      req.setTimeout(3000, () => req.destroy(new Error("Request timed out")));
      req.end(body);
    });
    assert.equal(await send(), 200);
    for (const [text, type] of [["{}", "application/json"], ["a=1", "application/x-www-form-urlencoded"]]) {
      const compressed = gzipSync(text);
      for (const body of [compressed, Buffer.concat([compressed, Buffer.from("trailing garbage")]), compressed.subarray(0, 12)]) {
        await send(body, type);
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(child.exitCode, null, logs);
        assert.equal(await send(), 200);
      }
    }
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, "exit"); }
  }
});
