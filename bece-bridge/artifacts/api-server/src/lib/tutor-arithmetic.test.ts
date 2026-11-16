import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCalculation, labelTutorArithmetic } from "./tutor-arithmetic";
import { checkUnitConversion } from "./tutor-units";

test("independent SI prefix and derived-dimension references", () => {
  // References from SI definitions, not from the implementation's unit table:
  // milli=10^-3, micro=10^-6, kilo=10^3; ohm=V/A and farad=C/V.
  for (const line of [
    "1000 [mV] = 1 [V]", "1 [MΩ] = 1000000 [ohm]", "1 [mA] = 1000 [uA]",
    "100 [µF] = 0.000100 [F]", "100 [μF] = 100000 [nF]", "1 [pF] = 0.001 [nF]",
    "2 [GHz] = 2000 [MHz]", "10 [cm] = 0.1 [m]", "1 [kg] = 1000 [g]",
    "1000 [mg] = 1 [g]", "1 [V/A] = 1 [ohm]", "1 [C/V] = 1 [F]",
    "1 [ohm*F] = 1 [s]", "1 [Hz] = 1 [s^-1]", "1 [cm^2] = 0.0001 [m^2]",
    "1 [W*s] = 1 [J]", "1 [H/s] = 1 [ohm]", "1 [m/m] = 1 [1]",
    "-25 [mV] = -0.025 [V]", "0 [V] = 0 [mV]", "1.23456 [mV] = 0.001235 [V]",
  ]) assert.equal(checkUnitConversion(line, checkCalculation).status, "passed", line);
  for (const line of ["1 [mA] = 1 [A]", "1 [MHz] = 1000 [Hz]", "1 [cm^2] = 0.01 [m^2]", "1 [uF] = 0 [F]"]) {
    assert.equal(checkUnitConversion(line, checkCalculation).reason, "conversion value mismatch", line);
  }
  for (const line of ["1 [V] = 1 [A]", "0 [s] = 0 [m]", "1 [Hz] = 1 [s]", "1 [V*A] = 1 [ohm]"]) {
    assert.equal(checkUnitConversion(line, checkCalculation).reason, "incompatible dimensions", line);
  }
});

test("unsupported units, malformed syntax and numeric extremes cannot earn unit passes", () => {
  for (const line of [
    "1 [degC] = 1 [degC]", "1 [dB] = 1 [dB]", "1 [rad] = 1 [1]", "1 [min] = 60 [s]",
    "1 [K] = 1 [K]", "1 [mv] = 1 [mv]", "1 [kHzfoo] = 1 [Hz]", "1 [mkg] = 1 [kg]",
    "1 [unknown^0] = 1 [1]", "1 [constructor] = 1 [constructor]", "1 [V/(A)] = 1 [ohm]",
    "1 [m^4] = 1 [m^4]", "1 [V] + 1 [V] = 2 [V]", "NaN [V] = 0 [V]",
    "1e999 [V] = 1 [V]", "1e-999 [V] = 0 [V]", "0 [V] = 1e-999 [V]",
    "1e-300 [pV] = 0 [V]", "1 [m*m*m*m*m*m*m] = 1 [m]",
    `${" ".repeat(201)}1 [V] = 1 [V]`,
  ]) assert.equal(checkUnitConversion(line, checkCalculation).status, "unchecked", line);
});

test("unit reports preserve original claims and independently disclose coverage", () => {
  const answer = "```units\n1000 [mV] = 1 [V]\n1 [V] = 1 [A]\n1 [dB] = 1 [dB]\n```";
  const report = labelTutorArithmetic(answer, true);
  assert.match(report, /Arithmetic unchecked/);
  assert.match(report, /1 passed; 1 mismatched; 1 unchecked marked conversions/);
  assert.match(report, /Conversion 2: incompatible dimensions/);
  assert.match(report, /Conversion 3: unsupported unit/);
  assert.match(report, /physical correctness/);
  assert.ok(report.endsWith(answer));
  assert.match(labelTutorArithmetic(answer, false), /Units unchecked/);
  assert.match(labelTutorArithmetic("1000 mV = 1 V", true), /Units unchecked/);
  assert.match(labelTutorArithmetic("```units\n" + "1 [V] = 1 [V]\n".repeat(13) + "```", true), /beyond the first 12/);
});

test("independent RC reference catches recovered intermediate mismatch", () => {
  assert.equal(checkCalculation("5 / e = 1.839395").status, "failed");
  assert.equal(checkCalculation("5 * exp(-1) = 1.839397").status, "passed");
  assert.equal(checkCalculation("2000 * (100 * 10^-6) = 0.2").status, "passed");
});
test("precision, signs, boundaries and scientific notation", () => {
  for (const line of ["1/3 = 0.3333", "-2^2 = -4", "(-2)^2 = 4", "2^-2 = 0.25", "sin(0) = 0", "1e-6 * 100 = 1.000e-4", "0 * 5 = 0"]) {
    assert.equal(checkCalculation(line).status, "passed", line);
  }
  for (const line of ["1/3 = 0.3334", "2+2 = 5", "1e-6 * 100 = 0.00100"]) {
    assert.equal(checkCalculation(line).status, "failed", line);
  }
});
test("unsafe code, symbolic math, units, invalid domains and resource limits never pass", () => {
  for (const line of ["process.exit() = 0", "constructor(1) = 1", "x + 1 = 2", "sum(256,1,0) = 256", "sqrt(-1) = 0", "1/0 = 0", "exp(1000) = 0", "1e999 = 0", "2 V = 2", "2 = 2 = 2", `${"(".repeat(40)}1${")".repeat(40)} = 1`, `${"1+".repeat(101)}1 = 203`]) {
    assert.notEqual(checkCalculation(line).status, "passed", line);
  }
});
test("operation-aware error allows cancellation and trig zeros, not arbitrary small errors", () => {
  for (const line of ["sin(pi) = 0", "cos(pi/2) = 0", "0.1 + 0.2 - 0.3 = 0", "sqrt(0) = 0"]) {
    assert.equal(checkCalculation(line).status, "passed", line);
  }
  for (const line of ["1e-20 = 0", "sin(1e-12) = 0", "0.1 + 0.2 - 0.3 + 1e-12 = 0", "1e20 * 1e-20 = 0"]) {
    assert.equal(checkCalculation(line).status, "failed", line);
  }
});
test("reports explicit partial, failed and absent coverage without changing original answer", () => {
  const answer = "Derived example [B1]\n```arithmetic\n5/e = 1.839395\n5/e = 1.839397\nx = 2\n```";
  const labeled = labelTutorArithmetic(answer, true);
  assert.match(labeled, /1 passed; 1 mismatched; 1 unchecked/);
  assert.match(labeled, /recomputed value 1.83939720586/);
  assert.ok(labeled.endsWith(answer));
  assert.match(labelTutorArithmetic(answer, false), /Arithmetic unchecked/);
  assert.match(labelTutorArithmetic("Symbolic derivation only.", true), /Arithmetic unchecked/);
  const bounded = labelTutorArithmetic("```arithmetic\n" + "1+1 = 2\n".repeat(20) + "```", true);
  assert.match(bounded, /12 passed/);
  assert.match(bounded, /beyond the first 12 were not checked/);
});

const report = (...lines: string[]) => labelTutorArithmetic(`\`\`\`arithmetic\n${lines.join("\n")}\n\`\`\``, true);

test("rounded exponential reuse cannot hide the 5/e discrepancy", () => {
  assert.equal(checkCalculation("5 * 0.367879 = 1.839395").status, "passed");
  const labeled = report("exp(-1) = 0.367879", "5 * ref(1) = 1.839395", "5/e = 1.839397");
  assert.match(labeled, /2 passed; 1 mismatched; 0 unchecked/);
  assert.match(labeled, /Calculation 2: recomputed value 1.83939720586/);
  assert.match(labeled, /Explicit reuse.*calculation\(s\) 1/);
});

test("unrelated reciprocal, square root and scientific-notation chains", () => {
  assert.match(report("1/3 = 0.3333", "ref(1) * 3 = 0.9999"), /1 passed; 1 mismatched/);
  assert.match(report("sqrt(2) = 1.4142", "ref(1)^2 = 1.999962"), /1 passed; 1 mismatched/);
  assert.match(report("1/30000 = 3.333e-5", "ref(1) * 30000 = 0.9999"), /1 passed; 1 mismatched/);
  assert.match(report("-1/3 = -0.3333", "ref(1) * 3 = -0.9999"), /1 passed; 1 mismatched/);
  // A negative literal must not accidentally reuse the positive result.
  assert.match(report("1/3 = 0.3333", "-0.3333 * 3 = -0.9999"), /2 passed; 0 mismatched/);
});

test("multi-hop and multi-input chains carry unrounded numeric values", () => {
  assert.match(report("1/3 = 0.3333", "ref(1) * 2 = 0.667", "ref(2) * 3 = 2.001"), /2 passed; 1 mismatched/);
  assert.match(report("1/3 = 0.3333", "1/7 = 0.1429", "ref(1) + ref(2) = 0.4762"), /3 passed; 0 mismatched/);
  assert.match(report("1/3 = 0.3333", "ref(1) * 2 = 0.6666", "ref(2) * 3 = 1.9998"), /1 passed; 1 mismatched; 1 unchecked/);
  assert.match(report("1/3 = 0.3333", "ref(1) * 2 = 0.6667", "ref(2) * 3 = 2"), /3 passed; 0 mismatched/);
});

test("invalid, singular and tainted dependencies stay unchecked", () => {
  for (const lines of [
    ["x = 0.33", "ref(1) * 3 = 0.99"],
    ["1/3 = 0.34", "ref(1) * 3 = 1.02"],
    ["1/3 = 0.3333", "1/(ref(1) * 3 - 1) = -10000"],
    ["malformed", "ref(1) = 1"],
  ]) {
    assert.match(report(...lines), /1 unchecked marked calculations|2 unchecked marked calculations/);
    assert.match(report(...lines), /invalid, unsupported or follows an unreliable/);
  }
});

test("scope stays bounded to earlier marked lines in this reply", () => {
  assert.match(report("0.3333 * 3 = 0.9999", "1/3 = 0.3333"), /2 passed/);
  assert.match(report("1/3 = 0.3333", "(1/3) * 3 = 1"), /2 passed/);
  assert.match(labelTutorArithmetic("```arithmetic\n1/3 = 0.3333\n```\nThen:\n```arithmetic\nref(1) * 3 = 0.9999\n```", true), /1 passed; 1 mismatched/);
  assert.match(labelTutorArithmetic("1/3 = 0.3333\n```arithmetic\n0.3333 * 3 = 0.9999\n```", true), /1 passed; 0 mismatched/);
  assert.match(report(...Array(12).fill("1/3 = 0.3333"), "0.3333*3 = 0.9999"), /12 passed.*beyond the first 12/);
  assert.match(report("1/3 = 0.3333", "0.3333 * 3 = 4"), /1 passed; 1 mismatched/);
});

test("equal decimals remain independent; explicit references disambiguate equal results", () => {
  assert.match(report("1/3 = 0.33", "33/100 = 0.33", "0.33 * 3 = 0.99"), /3 passed; 0 mismatched/);
  assert.match(report("1/3 = 0.33", "33/100 = 0.33", "ref(1) * 3 = 1", "ref(2) * 3 = 0.99"), /4 passed; 0 mismatched/);
  assert.match(report("x = 0.33", "0.33 * 3 = 0.99"), /1 passed; 0 mismatched; 1 unchecked/);
  assert.match(report("1/3 = 0.3333", "0.3333 * 3 = 0.9999"), /dependency provenance remains unchecked/);
});

test("references reject forward, cyclic, malformed and executable forms", () => {
  for (const ref of ["ref(0)", "ref(-1)", "ref(1.5)", "ref(13)", "ref()", "ref(1,2)", "ref(1+0)", "ref(ref(1))", "ref(x)", "ref(2)", "ref(1).value", "process.exit()"]) {
    assert.match(report("1 = 1", `${ref} = 1`), /1 passed; 0 mismatched; 1 unchecked/, ref);
  }
  assert.match(report("ref(1) = 1"), /0 passed; 0 mismatched; 1 unchecked/);
  assert.match(report("ref(2) = 1", "ref(1) = 1"), /0 passed; 0 mismatched; 2 unchecked/);
  assert.equal(checkCalculation("ref(1) = 1").status, "unchecked");
  assert.match(report("1=1", `${" ".repeat(200)}ref(1)=1`), /1 unchecked/);
  assert.match(labelTutorArithmetic("```arithmetic\n1=1\nref(1)=1\n```", false), /Arithmetic unchecked/);
});
