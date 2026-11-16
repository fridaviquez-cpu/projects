import { parseUnit, type NumericChecker, type UnitCheck } from "./tutor-units";

export const quantityInstructions = `For quantity arithmetic, use a separate quantities fenced block: expression = number [unit].
Every operand must be a signed decimal/scientific literal with a bracketed unit, including dimensionless scalars as [1]. Use the units vocabulary and factor grammar from unit conversions.
Supported operators: +, -, *, / with usual precedence, left associativity and parentheses (maximum depth 8). Maximum 12 operands and 200 characters per line, 12 lines per reply.
Example: (2 [V] + 500 [mV]) / 5 [ohm] = 0.5 [A].
No variables, functions, implicit products, expression powers, chained equalities or references to earlier lines. Substitute original inputs instead of rounded intermediate values.
Unsupported syntax stays unchecked. Checks cover only displayed quantity arithmetic and dimensions, never equation selection or physical model validity.`;

const literal = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:e[+-]?\\d+)?";
const quantity = new RegExp(`^(${literal})\\s*\\[([^\\[\\]]+)\\]`);
type Value = { value: number; expression: string; dimension: number[] };
const sameDimension = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
const normal = (n: number) => Number.isFinite(n) && (n === 0 || Math.abs(n) >= 2.2250738585072014e-308);

/** Separate, fully consumed grammar. No eval, variable binding or inferred provenance. */
export function checkQuantityCalculation(line: string, checkNumeric: NumericChecker): UnitCheck {
  const unchecked = { status: "unchecked", reason: "unsupported quantity syntax, unit or numeric range" } as const;
  if (line.length > 200) return unchecked;
  const sides = line.split("=");
  if (sides.length !== 2) return unchecked;
  let mismatch = false;
  let operands = 0;
  function readQuantity(text: string): { quantity: Value; length: number } {
    const match = quantity.exec(text);
    if (!match) throw Error("Expected quantity");
    const unit = parseUnit(match[2]!);
    if (!unit) throw Error("Unsupported unit");
    const input = Number(match[1]);
    const scale = 10 ** unit.power;
    const value = input * scale;
    if (!normal(input) || !normal(scale) || scale === 0 || !normal(value) ||
        input !== 0 && value === 0 ||
        input === 0 && /[1-9]/.test(match[1]!.split("e")[0]!)) throw Error("Numeric range");
    return { quantity: { value, dimension: unit.dimension,
      expression: `(${match[1]}*1e${unit.power})` }, length: match[0].length };
  }
  try {
    const text = sides[0]!.trim();
    let pos = 0;
    const space = () => { while (/\s/.test(text[pos] ?? "") && pos < text.length) pos++; };
    function atom(depth: number): Value {
      space();
      if (depth > 8) throw Error("Depth limit");
      if (text[pos] === "(") {
        pos++;
        const result = expression(depth + 1);
        space();
        if (text[pos++] !== ")") throw Error("Missing closing parenthesis");
        return result;
      }
      if (++operands > 12) throw Error("Operand limit");
      const result = readQuantity(text.slice(pos));
      pos += result.length;
      return result.quantity;
    }
    function combine(a: Value, op: string, b: Value): Value {
      const additive = op === "+" || op === "-";
      if (additive && !sameDimension(a.dimension, b.dimension)) mismatch = true;
      const dimension = additive ? a.dimension : a.dimension.map((v, i) => v + (op === "*" ? 1 : -1) * b.dimension[i]!);
      const value = op === "+" ? a.value + b.value : op === "-" ? a.value - b.value
        : op === "*" ? a.value * b.value : a.value / b.value;
      if (!normal(value) || ((op === "*" || op === "/") && a.value !== 0 && b.value !== 0 && value === 0)) {
        throw Error("Undefined or out-of-range intermediate");
      }
      return { value, dimension, expression: `(${a.expression}${op}${b.expression})` };
    }
    function product(depth: number): Value {
      let result = atom(depth);
      space();
      while (text[pos] === "*" || text[pos] === "/") {
        const op = text[pos++]!;
        result = combine(result, op, atom(depth));
        space();
      }
      return result;
    }
    function expression(depth: number): Value {
      let result = product(depth);
      space();
      while (text[pos] === "+" || text[pos] === "-") {
        const op = text[pos++]!;
        result = combine(result, op, product(depth));
        space();
      }
      return result;
    }
    const input = expression(0);
    if (pos !== text.length) return unchecked;
    const resultText = sides[1]!.trim();
    const result = readQuantity(resultText);
    if (result.length !== resultText.length) return unchecked;
    if (mismatch || !sameDimension(input.dimension, result.quantity.dimension)) {
      return { status: "failed", reason: "incompatible dimensions in quantity arithmetic" };
    }
    const output = quantity.exec(resultText)!;
    const unit = parseUnit(output[2]!)!;
    const converted = input.value / 10 ** unit.power;
    if (!normal(converted) || input.value !== 0 && converted === 0) return unchecked;
    const checked = checkNumeric(`${input.expression}/1e${unit.power} = ${output[1]}`);
    return { status: checked.status, reason: checked.status === "passed" ? "quantity arithmetic and dimensions agree"
      : checked.status === "failed" ? "quantity arithmetic value mismatch" : unchecked.reason };
  } catch {
    return unchecked;
  }
}

export function labelTutorQuantities(answer: string, supported: boolean, checkNumeric: NumericChecker): string {
  const checks: UnitCheck[] = [];
  let omitted = false;
  if (supported) {
    for (const match of answer.matchAll(/^```quantities[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)) {
      for (const line of match[1]!.split(/\r?\n/).filter(line => line.trim())) {
        if (checks.length === 12) { omitted = true; break; }
        checks.push(checkQuantityCalculation(line, checkNumeric));
      }
      if (omitted) break;
    }
  }
  const count = (status: UnitCheck["status"]) => checks.filter(c => c.status === status).length;
  const summary = checks.length
    ? `**Quantity arithmetic/dimension check: ${count("failed") ? "mismatch detected" : "limited check"}.** ${count("passed")} passed; ${count("failed")} mismatched; ${count("unchecked")} unchecked marked quantity calculations.`
    : "**Quantity arithmetic unchecked.** No supported quantity calculations were checked.";
  const details = checks.flatMap((c, i) => c.status === "passed" ? [] : [
    `Quantity calculation ${i + 1}: ${c.reason}.${c.status === "failed" ? " Do not rely on the displayed result." : ""}`,
  ]);
  return `${summary}${omitted ? " Quantity calculations beyond the first 12 were not checked." : ""}\n\n${details.length ? details.join("\n\n") + "\n\n" : ""}Only displayed quantities blocks are eligible. Unsupported expressions and units outside marked blocks remain unchecked. Decimal results use half the last displayed place plus floating-point tolerance; integer results use floating-point tolerance only. Lines are independent: rounded-input accuracy and cross-line dependencies are unchecked. This does not verify equation choice, symbolic equivalence, physical assumptions or physical correctness.`;
}
