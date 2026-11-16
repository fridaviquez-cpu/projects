// Deliberately finite SI vocabulary. Dimensions are [mass, length, time, current].
type Dimension = readonly [number, number, number, number];
const bases: Record<string, Dimension> = {
  m: [0, 1, 0, 0], s: [0, 0, 1, 0], A: [0, 0, 0, 1],
  Hz: [0, 0, -1, 0], V: [1, 2, -3, -1], ohm: [1, 2, -3, -2],
  Ω: [1, 2, -3, -2], F: [-1, -2, 4, 2], H: [1, 2, -2, -2],
  W: [1, 2, -3, 0], J: [1, 2, -2, 0], C: [0, 0, 1, 1],
};
const prefixes: Record<string, number> = { p: -12, n: -9, u: -6, "µ": -6, "μ": -6, m: -3, c: -2, k: 3, M: 6, G: 9 };

export const unitInstructions = `For explicit unit conversions, show each claim in a units fenced code block as number [unit] = decimalResult [unit], e.g. 1000 [mV] = 1 [V].
Supported case-sensitive units: m, s, A, Hz, V, ohm, Ω, F, H, W, J, C, kg, g, and dimensionless 1. Prefixes p, n, u/µ/μ, m, c, k, M, G apply to the named units except kg and 1; g supports prefixes.
Unit expressions allow at most 6 factors joined by * or / (left to right), with integer powers -3 through 3; no parentheses. Example: 1 [V/A] = 1 [ohm].
Use original inputs, not rounded intermediates. Maximum 12 conversion lines, 200 characters each. Unsupported units or syntax remain unchecked; never rewrite them as supported units just to earn a check. Unit blocks check only the displayed conversion and dimensions, not equations or physical validity.`;

export function parseUnit(text: string): { power: number; dimension: number[] } | undefined {
  const factors = text.trim().split(/([*/])/);
  if (factors.length > 11) return;
  let power = 0;
  const dimension = [0, 0, 0, 0];
  for (let i = 0; i < factors.length; i += 2) {
    const match = /^([A-Za-zµμΩ]+|1)(?:\^(-?[0-3]))?$/.exec(factors[i]!.trim());
    if (!match) return;
    const symbol = match[1]!;
    let base = symbol, prefixPower = 0;
    let dim: Dimension | undefined;
    if (symbol === "1") dim = [0, 0, 0, 0];
    else if (symbol === "kg") dim = [1, 0, 0, 0];
    else {
      if (!Object.hasOwn(bases, base) && base !== "g") {
        if (!Object.hasOwn(prefixes, base[0]!)) return;
        prefixPower = prefixes[base[0]!]!;
        base = base.slice(1);
      }
      if (base === "g") { dim = [1, 0, 0, 0]; prefixPower -= 3; }
      else if (Object.hasOwn(bases, base)) dim = bases[base];
    }
    // Unknown factors remain unchecked even with exponent zero.
    if (!dim) return;
    const exponent = Number(match[2] ?? 1) * (i > 0 && factors[i - 1] === "/" ? -1 : 1);
    power += prefixPower * exponent;
    dim.forEach((value, j) => { dimension[j]! += value * exponent; });
  }
  return { power, dimension };
}

export type UnitCheck = { status: "passed" | "failed" | "unchecked"; reason: string };
export type NumericChecker = (line: string) => { status: UnitCheck["status"] };
const numberPattern = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:e[+-]?\\d+)?";
const conversion = new RegExp(`^\\s*(${numberPattern})\\s*\\[([^\\[\\]]+)\\]\\s*=\\s*(${numberPattern})\\s*\\[([^\\[\\]]+)\\]\\s*$`);

export function checkUnitConversion(line: string, checkNumeric: NumericChecker): UnitCheck {
  const unchecked = { status: "unchecked", reason: "unsupported unit, syntax or numeric range" } as const;
  if (line.length > 200) return unchecked;
  const match = conversion.exec(line);
  if (!match) return unchecked;
  const from = parseUnit(match[2]!), to = parseUnit(match[4]!);
  if (!from || !to) return unchecked;
  if (from.dimension.some((value, i) => value !== to.dimension[i])) {
    return { status: "failed", reason: "incompatible dimensions" };
  }
  const input = Number(match[1]), result = Number(match[3]);
  const scale = 10 ** (from.power - to.power);
  const normalized = input * scale;
  // Never allow underflow to silently turn a nonzero quantity into zero.
  if (![input, result, scale, normalized].every(Number.isFinite) || scale === 0 ||
      input === 0 && /[1-9]/.test(match[1]!.split("e")[0]!) ||
      result === 0 && /[1-9]/.test(match[3]!.split("e")[0]!) ||
      input !== 0 && (normalized === 0 || Math.abs(normalized) < 2.2250738585072014e-308)) return unchecked;
  const check = checkNumeric(`${match[1]} * 1e${from.power - to.power} = ${match[3]}`);
  return { status: check.status, reason: check.status === "passed" ? "conversion and dimensions agree"
    : check.status === "failed" ? "conversion value mismatch" : unchecked.reason };
}

export function labelTutorUnits(answer: string, supported: boolean, checkNumeric: NumericChecker): string {
  const checks: UnitCheck[] = [];
  let omitted = false;
  if (supported) {
    for (const match of answer.matchAll(/^```units[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)) {
      for (const line of match[1]!.split(/\r?\n/).filter(line => line.trim())) {
        if (checks.length === 12) { omitted = true; break; }
        checks.push(checkUnitConversion(line, checkNumeric));
      }
      if (omitted) break;
    }
  }
  const count = (status: UnitCheck["status"]) => checks.filter(c => c.status === status).length;
  const summary = checks.length
    ? `**Unit conversion/dimension check: ${count("failed") ? "mismatch detected" : "limited check"}.** ${count("passed")} passed; ${count("failed")} mismatched; ${count("unchecked")} unchecked marked conversions.`
    : "**Units unchecked.** No supported unit conversions were checked.";
  const details = checks.flatMap((c, i) => c.status !== "passed" ? [`Conversion ${i + 1}: ${c.reason}.${c.status === "failed" ? " Do not rely on the displayed conversion." : ""}`] : []);
  return `${summary}${omitted ? " Conversions beyond the first 12 were not checked." : ""}\n\n${details.length ? details.join("\n\n") + "\n\n" : ""}Only supported conversions explicitly shown in units blocks are eligible. Unsupported units and all units outside those blocks remain unchecked. This does not verify equation choice, physical assumptions or physical correctness.`;
}
