// Run: node --experimental-strip-types src/lib/signal.test.ts
import assert from "node:assert/strict";
import { sampleSignal, sinusoid } from "./signal.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
// quarter cycle reaches amplitude
near(sinusoid(3, 2, 0, 1 / 8), 3);
// phase +90 deg starts at peak, -90 at trough
near(sinusoid(4, 5, 90, 0), 4);
near(sinusoid(4, 5, -90, 0), -4);
// frequency: zero crossing after half period
near(sinusoid(5, 10, 0, 0.05), 0);
near(sinusoid(2, 4, 0, 1 / 16), 2);
const s = sampleSignal({ a: 5, f: 10, phase: 0 });
assert.ok(s.ok);
if (s.ok) { assert.equal(s.points.length, 401); near(s.points[0].t, 0); near(s.points[400].t, 1); near(s.points[1].t, 0.0025); near(s.periodS, 0.1); near(s.points[10].v, 5); }
for (const bad of [{ a: 6, f: 1, phase: 0 }, { a: -1, f: 1, phase: 0 }, { a: 1, f: 0.5, phase: 0 }, { a: 1, f: 11, phase: 0 }, { a: 1, f: 1, phase: 181 }, { a: NaN, f: 1, phase: 0 }]) {
  assert.ok(!sampleSignal(bad).ok, JSON.stringify(bad));
}
const e = sampleSignal({ a: 9, f: 20, phase: -200 });
assert.ok(!e.ok); if (!e.ok) { assert.ok(e.errors.a && e.errors.f && e.errors.phase); }
console.log("signal tests passed");
