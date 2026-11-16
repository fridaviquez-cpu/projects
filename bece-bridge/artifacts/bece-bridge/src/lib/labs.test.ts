// Run: node --experimental-strip-types src/lib/labs.test.ts
import assert from "node:assert/strict";
import { solveOhm } from "./ohm.ts";
import { evalGate, truthTable } from "./logic.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const o = solveOhm({ v: 12, rK: 4 });
assert.ok(o.ok); if (o.ok) { near(o.iMa, 3); near(o.pMw, 36); }
const z = solveOhm({ v: 0, rK: 1 }); assert.ok(z.ok); if (z.ok) near(z.pMw, 0);
const bad = solveOhm({ v: NaN, rK: 0 }); assert.ok(!bad.ok); if (!bad.ok) { assert.ok(bad.errors.v); assert.ok(bad.errors.rK); }
assert.ok(!solveOhm({ v: 60, rK: 1 }).ok);

assert.deepEqual(truthTable("AND").map((r) => r.out), [0, 0, 0, 1]);
assert.deepEqual(truthTable("OR").map((r) => r.out), [0, 1, 1, 1]);
assert.deepEqual(truthTable("XOR").map((r) => r.out), [0, 1, 1, 0]);
assert.deepEqual(truthTable("NOT").map((r) => r.out), [1, 0]);
assert.throws(() => evalGate("AND", 2 as never, 0));
console.log("labs tests passed");
