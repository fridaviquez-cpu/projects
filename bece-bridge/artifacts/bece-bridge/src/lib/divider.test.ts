// Run: node --experimental-strip-types src/lib/divider.test.ts
import assert from "node:assert/strict";
import { solveDivider } from "./divider.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

const a = solveDivider({ vs: 12, r1: 4, r2: 2 });
assert.ok(a.ok);
if (a.ok) { near(a.iMa, 2); near(a.v1, 8); near(a.v2, 4); near(a.pMw, 24); near(a.v1 + a.v2, 12); }

const b = solveDivider({ vs: 9, r1: 3.3, r2: 6.8 });
assert.ok(b.ok);
if (b.ok) { near(b.iMa, 9 / 10.1); near(b.v2, 9 * 6.8 / 10.1); near(b.pMw, 81 / 10.1); }

for (const bad of [{ vs: 0, r1: 1, r2: 1 }, { vs: 25, r1: 1, r2: 1 }, { vs: 5, r1: 0.5, r2: 1 }, { vs: 5, r1: 1, r2: 21 }, { vs: NaN, r1: 1, r2: 1 }]) {
  assert.equal(solveDivider(bad).ok, false);
}
console.log("divider tests passed");
