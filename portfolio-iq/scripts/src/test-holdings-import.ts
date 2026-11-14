import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Integration regression check against the shared development proxy.
// Uses isolated, newly created guest workspaces; never reads an existing browser session.
const base = "http://localhost:80/api";
type SavedHolding = { id: string; symbol: string; type: string; isSample: boolean; costBasisCents: number | null };
async function guest() {
  const response = await fetch(`${base}/workspace`);
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.ok(cookie);
  const call = (path: string, body?: unknown) => fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const holdings = async (): Promise<SavedHolding[]> => {
    const response = await call("/workspace");
    assert.equal(response.status, 200);
    return ((await response.json()) as { holdings: SavedHolding[] }).holdings;
  };
  return { call, holdings };
}

const a = await guest();
const b = await guest();
const holding = (symbol: string) => ({
  symbol, name: `Import check ${symbol}`, type: "Stock", quantity: 2.5,
  priceCents: 1234, costBasisCents: null, notes: "", priceDate: "2026-11-14",
});
const batch = (holdings: unknown[], duplicateBehavior = "skip") => ({ importId: randomUUID(), duplicateBehavior, holdings });

// Every row is validated before committing, including real dates and integer cents.
for (const bad of [
  { ...holding("BAD"), priceDate: "2026-02-30" },
  { ...holding("BAD"), priceCents: 1.5 },
  { ...holding("BAD"), quantity: 0 },
  { ...holding("BAD"), quantity: 0.0000001 },
  { ...holding("BAD"), symbol: "bad symbol" },
]) {
  const response = await a.call("/holdings/import", batch([holding("GOOD"), bad]));
  assert.equal(response.status, 400);
  assert.equal((await a.holdings()).length, 0, "invalid batch must not partially save");
}
assert.equal((await a.call("/holdings/import", batch([]))).status, 400);
assert.equal((await a.call("/holdings/import", batch(Array.from({ length: 201 }, () => holding("MANY"))))).status, 400);

const input = batch([holding("FIRST"), { ...holding("SECOND"), costBasisCents: 0 }]);
const initial = await a.call("/holdings/import", input);
assert.equal(initial.status, 200);
const result = await initial.json();
assert.deepEqual(result, { importId: input.importId, imported: 2, skipped: 0 });
assert.deepEqual(await (await a.call("/holdings/import", input)).json(), result);
assert.deepEqual(await (await a.call("/holdings/import", input)).json(), result);
assert.equal((await a.holdings()).length, 2, "retries must replay instead of adding");
assert.equal((await a.holdings())[0].costBasisCents, null);
assert.equal((await a.holdings())[1].costBasisCents, 0);
assert.ok((await a.holdings()).every((h) => !h.isSample));
assert.equal((await a.call("/holdings/import", { ...input, duplicateBehavior: "add" })).status, 409);
assert.equal((await a.holdings()).length, 2);
assert.equal((await b.holdings()).length, 0, "imports belong only to the current guest");
assert.equal((await fetch(`${base}/holdings/import`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
})).status, 401);

const skipped = await a.call("/holdings/import", batch([holding("FIRST"), holding("THIRD"), holding("third")]));
assert.equal(skipped.status, 200);
assert.equal(((await skipped.json()) as { skipped: number }).skipped, 2);
assert.equal((await a.holdings()).length, 3);
const rejected = await a.call("/holdings/import", batch([holding("FOURTH"), holding("FIRST")], "reject"));
assert.equal(rejected.status, 409);
assert.equal((await a.holdings()).length, 3, "duplicate rejection must roll back earlier valid rows");
assert.equal((await a.call("/holdings/import", batch([holding("FIRST")], "add"))).status, 200);
assert.equal((await a.holdings()).filter((h) => h.symbol === "FIRST").length, 2);

const concurrent = batch([holding("RACE")], "add");
const races = await Promise.all([a.call("/holdings/import", concurrent), a.call("/holdings/import", concurrent)]);
assert.ok(races.every((r) => r.status === 200));
assert.deepEqual(await races[0].json(), await races[1].json());
assert.equal((await a.holdings()).filter((h) => h.symbol === "RACE").length, 1);

// Same request identifier is scoped per guest, not shared globally.
assert.equal((await b.call("/holdings/import", concurrent)).status, 200);
assert.equal((await b.holdings()).length, 1);
const c = await guest();
assert.equal((await c.call("/workspace/sample", {})).status, 200);
const samples = await c.holdings();
assert.ok(samples.length > 0 && samples.every((h) => h.isSample));
const sampleImport = await c.call("/holdings/import", batch([{ ...holding(samples[0].symbol), type: samples[0].type }]));
assert.equal(sampleImport.status, 200);
assert.equal(((await sampleImport.json()) as { imported: number }).imported, 1);
const after = await c.holdings();
assert.equal(after.filter((h) => h.isSample).length, samples.length);
assert.deepEqual(after.filter((h) => h.isSample), samples);

console.info("CSV batch API checks passed: validation, atomic rollback, unknown cost, duplicate policies, sample preservation, guest ownership, sequential and concurrent retries.");
