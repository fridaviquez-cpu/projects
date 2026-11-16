import { test } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import { request } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import express from "express";

if (process.argv.includes("--parser-child")) {
  // Deliberately isolated: no app DB, auth provider, real server, or student data.
  // Keep these settings identical to app.ts; the parent checks that contract.
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: true }));
  app.post("/echo", (req, res) => res.json(req.body));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: "Rejected body" }));
  const server = app.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
} else {
  test("production parser resolves the patched version and retains tested options", () => {
    const fromExpress = createRequire(createRequire(import.meta.url).resolve("express"));
    const version = fromExpress("body-parser/package.json").version.split(".").map(Number);
    assert.ok(version[0] === 2 && version[1] >= 4, "Express must resolve patched body-parser 2.4+");
    const source = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    assert.ok(source.includes('express.json({ limit: "32kb" })'));
    assert.ok(source.includes('express.urlencoded({ extended: true })'));
  });

  test("malformed compressed requests cannot terminate the isolated API process", { timeout: 20000 }, async t => {
    const child = fork(fileURLToPath(import.meta.url), ["--parser-child"], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
    let stderr = "";
    child.stderr.on("data", b => { stderr += b; });
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit"); child.kill(); await exited;
      }
    });
    const [{ port }] = await once(child, "message");
    async function send(body, type = "application/json", encoding, splitAt) {
      return new Promise((resolve, reject) => {
        const req = request({ hostname: "127.0.0.1", port, path: "/echo", method: "POST",
          headers: { "Content-Type": type, ...(encoding ? { "Content-Encoding": encoding } : {}) } }, res => {
          let text = ""; res.on("data", b => { text += b; });
          res.on("end", () => resolve({ status: res.statusCode, text }));
        });
        req.on("error", reject);
        if (splitAt) { req.write(body.subarray(0, splitAt)); setTimeout(() => req.end(body.subarray(splitAt)), 15); }
        else req.end(body);
      });
    }
    assert.deepEqual(await send(Buffer.from('{"value":7}')), { status: 200, text: '{"value":7}' });
    assert.equal((await send(Buffer.from("value=7&name=student"), "application/x-www-form-urlencoded")).status, 200);
    assert.equal((await send(Buffer.from("{broken"))).status, 400);
    assert.equal((await send(Buffer.from(JSON.stringify({ text: "a".repeat(33000) })))).status, 413);
    let cases = 0;
    for (const [encoding, compress] of [["gzip", gzipSync], ["deflate", deflateSync], ["br", brotliCompressSync]]) {
      for (const [type, text] of [["application/json", '{"value":7}'], ["application/x-www-form-urlencoded", "value=7"]]) {
        const valid = compress(Buffer.from(text));
        assert.equal((await send(valid, type, encoding)).status, 200);
        const trailing = Buffer.concat([valid, Buffer.from("not-a-valid-compressed-frame")]);
        for (const splitAt of [undefined, valid.length]) {
          const result = await send(trailing, type, encoding, splitAt);
          // A decoder may ignore trailing bytes or reject them; neither may crash.
          assert.ok([200, 400].includes(result.status), `${encoding}: unexpected ${result.status}`);
          await new Promise(resolve => setTimeout(resolve, 50));
          assert.equal(child.exitCode, null, stderr);
          assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
          cases++;
        }
      }
    }
    assert.equal((await send(Buffer.from("not compressed"), "application/json", "gzip")).status, 400);
    assert.equal((await send(Buffer.from("{}"), "application/json", "unsupported")).status, 415);
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    assert.equal(stderr, "", "No uncaught decoder errors");
    t.diagnostic(`${cases} trailing-data cases; valid compressed JSON/forms and malformed/oversized-body checks passed.`);
  });
}
