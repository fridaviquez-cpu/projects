import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCalculation, labelTutorArithmetic, arithmeticInstructions } from "./tutor-arithmetic";
import { checkQuantityCalculation } from "./tutor-quantities";

const check = (line: string) => checkQuantityCalculation(line, checkCalculation);

test("quantity arithmetic agrees with independent SI definition references", () => {
  // Independent identities: V=kg m² s^-3 A^-1, ohm=V/A,
  // C=A s, J=W s, F=C/V, H=V s/A. These test dimensions,
  // not whether Ohm's law or any other physical model applies.
  for (const line of [
    "2 [V] + 500 [mV] = 2.5 [V]",
    "2 [mA] * 3 [kohm] = 6 [V]",
    "(2 [V] + 500 [mV]) / 5 [ohm] = 0.5 [A]",
    "2 [A] * 3 [s] = 6 [C]",
    "2 [W] * 3 [s] = 6 [J]",
    "6 [C] / 2 [V] = 3 [F]",
    "2 [V] * 3 [s] / 4 [A] = 1.5 [H]",
    "2 [kg] * 3 [m^2/s^3/A] = 6 [V]",
    "2 [ohm] * 3 [F] = 6 [s]",
    "2 [Hz] * 3 [s] = 6 [1]",
    "2 [cm] * 3 [cm] = 0.0006 [m^2]",
    "1 [kg] - 500 [g] = 0.5 [kg]",
    "2 [1] * -3 [mV] = -0.006 [V]",
    "1e-3 [A] + -500 [uA] = 0.5 [mA]",
    "2 [V] + 3 [A] * 4 [ohm] = 14 [V]",
    "12 [V] / 2 [A] / 3 [1] = 2 [ohm]",
    "1 [V] - 1 [V] = 0 [mV]",
    "0 [A] * 3 [ohm] = 0 [V]",
    "0.1 [V] + 0.2 [V] - 0.3 [V] = 0 [V]",
    "1 [V] / 3 [ohm] = 0.3333 [A]",
    "(".repeat(8) + "1 [V]" + ")".repeat(8) + " = 1 [V]",
    Array(12).fill("1 [V]").join("+") + " = 12 [V]",
  ]) assert.equal(check(line).status, "passed", line);
});

test("incompatible intermediate additions fail even if final dimensions match", () => {
  for (const line of [
    "(2 [V] + 3 [A]) * 4 [A] = 20 [W]",
    "0 [V] + 0 [A] = 0 [V]",
    "2 [V] - 1 [s] = 1 [V]",
    "2 [A] * 3 [ohm] = 6 [W]",
    "1 [Hz] + 1 [s] = 2 [Hz]",
  ]) assert.equal(check(line).reason, "incompatible dimensions in quantity arithmetic", line);
  for (const line of [
    "2 [mA] * 3 [kohm] = 0.006 [V]",
    "1 [V] / 3 [ohm] = 0.3334 [A]",
    "1e-20 [V] + 0 [V] = 0 [V]",
    "2 [V] + 3 [A] * 4 [ohm] = 20 [V]",
  ]) assert.equal(check(line).reason, "quantity arithmetic value mismatch", line);
});

test("unsupported quantity grammar and numeric extremes remain unchecked", () => {
  for (const line of [
    "2 [V] + x = 3 [V]", "2 + 3 [V] = 5 [V]", "2 [V] 3 [A] = 6 [W]",
    "2 [V] ^ 2 = 4 [V^2]", "-(2 [V]) = -2 [V]", "sqrt(4 [V^2]) = 2 [V]",
    "2 [degC] + 3 [degC] = 5 [degC]", "1 [unknown^0] = 1 [1]",
    "1 [V/(A)] = 1 [ohm]", "1 [mv] + 1 [mv] = 2 [mv]",
    "1 [V] + 1 [A] + 1 [unknown] = 3 [V]",
    "1 [V] + 1 [A] = 2 [V] trailing", "1 [V] = 1 [V] = 1 [V]",
    "process.exit() = 0 [1]", "1 [V] / 0 [A] = 0 [ohm]",
    "1e999 [V] = 1 [V]", "1e-999 [V] = 0 [V]", "0 [V] = 1e-999 [V]",
    "1e-300 [pV] = 0 [V]", "1e300 [V] * 1e300 [A] = 1 [W]",
    "1e-200 [V] * 1e-200 [A] = 0 [W]",
    "1e-200 [V] / 1e200 [A] = 0 [ohm]",
    "(".repeat(9) + "1 [V]" + ")".repeat(9) + " = 1 [V]",
    Array(13).fill("1 [V]").join("+") + " = 13 [V]",
    " ".repeat(201) + "1 [V] = 1 [V]",
  ]) assert.equal(check(line).status, "unchecked", line);
});

test("quantity reports disclose independent bounds without hiding other checks", () => {
  const answer = "```quantities\n2 [mA] * 3 [kohm] = 6 [V]\n0 [V] + 0 [A] = 0 [V]\n2 + 3 [V] = 5 [V]\n```";
  const report = labelTutorArithmetic(answer, true);
  assert.match(arithmeticInstructions, /quantities fenced block/);
  assert.match(report, /1 passed; 1 mismatched; 1 unchecked marked quantity calculations/);
  assert.match(report, /Quantity calculation 2: incompatible dimensions/);
  assert.match(report, /Quantity calculation 3: unsupported quantity/);
  assert.match(report, /Do not rely on the displayed result/);
  assert.match(report, /cross-line dependencies are unchecked/);
  assert.match(report, /does not verify equation choice/);
  assert.ok(report.endsWith(answer));
  assert.match(labelTutorArithmetic(answer, false), /Quantity arithmetic unchecked/);
  assert.match(labelTutorArithmetic("2 [V] + 3 [V] = 5 [V]", true), /Quantity arithmetic unchecked/);
  const block = "```quantities\n" + "1 [V] + 1 [V] = 2 [V]\n".repeat(6) + "```";
  assert.match(labelTutorArithmetic([block, block, block].join("\n"), true), /12 passed; 0 mismatched; 0 unchecked marked quantity calculations/);
  assert.match(labelTutorArithmetic([block, block, block].join("\n"), true), /Quantity calculations beyond the first 12/);
});
