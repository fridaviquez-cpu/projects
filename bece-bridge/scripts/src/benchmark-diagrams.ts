/**
 * Opt-in live AI selection benchmark, independent of numerical graph benchmarks.
 * Uses eight shared generation attempts. Requires the development API workflow.
 * Run: pnpm --filter @workspace/scripts exec tsx src/benchmark-diagrams.ts
 */
import assert from "node:assert/strict";
import { GenerateVisualResponse, ComputeVisualResponse, ListVisualModelsResponse } from "@workspace/api-zod";

const base = "http://localhost:80/api/bridge";
const cookies = new Map<string, string>();
async function request(path: string, data?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Bridge-Request": "1", Cookie: [...cookies.values()].join("; ") },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  for (const value of response.headers.getSetCookie()) {
    const cookie = value.split(";")[0]!;
    cookies.set(cookie.split("=")[0]!, cookie);
  }
  return { status: response.status, data: await response.json() };
}

const cases = [
  { courseId: "391", prompt: "Draw an unloaded DC resistor-divider schematic with Vin 12 V, R1 2 kiloohms and R2 4 kiloohms.", model: "circuit-divider", values: { vin: 12, r1: 2, r2: 4 } },
  { courseId: "220", prompt: "Show a signal-flow diagram of a single negative-feedback loop with constant scalar forward gain G=4 and feedback gain H=0.5.", model: "feedback-flow", values: { g: 4, h: 0.5 } },
  { courseId: "110", prompt: "Draw the state-machine diagram of a modulo-3 counter, initially zero, advancing on every rising clock edge.", model: "counter-fsm", values: { n: 3 } },
  { courseId: "120", prompt: "Draw an unloaded DC divider with a 5 V source and two 1000 ohm resistors.", model: "circuit-divider", values: { vin: 5, r1: 1, r2: 1 } },
  { courseId: "210", prompt: "Draw a traffic-light state machine with red, amber and green states and timed transitions.", model: null },
  { courseId: "110", prompt: "Draw a loaded resistor divider with a third load resistor in parallel with R2.", model: null },
  { courseId: "220", prompt: "Draw a signal-flow diagram of a feedback system G(s)=1/(s+1), H=1, and analyze its stability.", model: null },
  { courseId: "120", prompt: "Draw a modulo-20 counter state diagram.", model: null },
];

assert.equal((await request("/session", {})).status, 200);
const catalog = await request("/visuals/models");
assert.equal(catalog.status, 200);
const models = ListVisualModelsResponse.parse(catalog.data);
for (const id of ["circuit-divider", "feedback-flow", "counter-fsm"]) assert.ok(models.some(m => m.id === id));
for (const c of cases) {
  const r = await request("/visuals", { courseId: c.courseId, prompt: c.prompt });
  assert.equal(r.status, c.model ? 200 : 422, JSON.stringify(r.data));
  if (c.model) {
    const result = GenerateVisualResponse.parse(r.data);
    assert.equal(result.model, c.model);
    assert.ok(result.diagram);
    assert.ok(result.grounding && result.assumptions && result.sources?.length);
    for (const [key, value] of Object.entries(c.values!)) assert.equal(result.controls.find(v => v.key === key)?.value, value);
    const edited = await request("/visuals/compute", { courseId: c.courseId, model: c.model, values: c.model === "counter-fsm" ? { n: 6 } : c.values });
    assert.equal(edited.status, 200);
    const computed = ComputeVisualResponse.parse(edited.data);
    if (c.model === "counter-fsm") assert.equal(computed.diagram?.nodes.length, 6);
  } else assert.ok(r.data && typeof r.data === "object" && "error" in r.data && r.data.error);
  console.log(`PASS ${c.courseId}: ${c.model ?? "unsupported"} — ${c.prompt}`);
}
for (const values of [{ n: 7 }, { n: 2.5 }, { svg: 1 }]) {
  assert.equal((await request("/visuals/compute", { courseId: "110", model: "counter-fsm", values })).status, 422);
}
console.log("Diagram benchmark passed: 4 supported selections, 4 unsupported selections, parameter edits and rejected edits.");
