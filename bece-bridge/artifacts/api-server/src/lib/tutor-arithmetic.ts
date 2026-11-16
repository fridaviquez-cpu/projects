import { parseExpression, evaluator } from "./visual-expressions";
import { labelTutorUnits } from "./tutor-units";
import { labelTutorQuantities, quantityInstructions } from "./tutor-quantities";

export const arithmeticInstructions = `Put each numeric evaluation you show (including intermediate values) in an arithmetic fenced code block, one line per calculation: expression = decimalResult.
Use only numeric literals, e, pi, + - * / ^, parentheses, exp, log (natural), sqrt, abs, sin or cos (radians), and ref(n) as described below. Substitute original inputs or use ref(n) for a reused intermediate; do not copy rounded intermediate decimals. Include units and assumptions outside the block. No variables, assignments, code, LaTeX or comments inside it. Maximum 12 calculations, 200 characters per line. Use at least 4 significant digits for noninteger results.
ref(n) means the unrounded numeric result of earlier displayed calculation n in this reply. Count nonempty calculation lines across all arithmetic blocks starting at 1. Use a literal integer from 1 to 12, strictly less than the current line number. No forward, self, cross-reply or symbolic references. Place each block beside the explanation it supports, not in a separate verification list. Explain each referenced quantity outside the block. Unrelated equal decimals are independent inputs, not references. This notation declares reuse but does not prove the physical meaning or validity of a formula.
Example block:
\`\`\`arithmetic
2000 * (100 * 10^-6) = 0.2
exp(-1) = 0.367879
5 * ref(2) = 1.839397
\`\`\`
Do not supply verification badges or claim that calculations were checked. The server adds its own arithmetic-only status. Math outside these blocks remains unchecked.
${quantityInstructions}`;

type Check = { status: "passed" | "failed" | "unchecked"; expected?: number; tolerance?: number; dependency?: string };
type Node = ReturnType<typeof parseExpression>;
type Value = { value: number; error: number };
const decimal = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/;
const allowed = new Set(["+", "-", "*", "/", "^", "neg", "pos", "e", "pi", "exp", "log", "sqrt", "abs", "sin", "cos"]);

// Propagate absolute floating-point uncertainty through operations rather than
// imposing an absolute floor (which would accept genuinely small nonzero values
// as zero). This is an engineering error estimate, not interval verification.
function arithmeticValue(node: Node, resolve?: (node: Node) => Value | undefined): Value {
  const replacement = resolve?.(node);
  if (replacement) return replacement;
  const args = "value" in node ? [] : node.args.map(arg => arithmeticValue(arg, resolve));
  const value = evaluator()("value" in node ? node : { ...node, args: args.map(a => ({ value: a.value })) }, {});
  const rounding = 8 * Number.EPSILON * Math.abs(value);
  if ("value" in node || !node.args.length) return { value, error: rounding };
  const a = args[0]!, b = args[1];
  let error: number;
  switch (node.name) {
    case "+": case "-": error = a.error + b!.error; break;
    case "*": error = Math.abs(b!.value) * a.error + Math.abs(a.value) * b!.error + a.error * b!.error; break;
    case "/": {
      const denominator = Math.abs(b!.value) - b!.error;
      error = denominator > 0 ? (a.error + Math.abs(value) * b!.error) / denominator : Infinity;
      break;
    }
    case "^":
      // Negative bases require a fixed integer exponent. Zero-base derivatives
      // are singular below power 1; conservatively leave those unchecked.
      error = Math.abs(b!.value * Math.pow(a.value, b!.value - 1)) * a.error;
      if (a.value > 0) error += Math.abs(value * Math.log(a.value)) * b!.error;
      else if (!Number.isInteger(b!.value)) error = Infinity;
      break;
    case "exp": error = Math.exp(a.value + a.error) * a.error; break;
    case "log": error = a.value > a.error ? a.error / (a.value - a.error) : Infinity; break;
    case "sqrt": error = a.value === 0 && a.error === 0 ? 0
      : a.value > a.error ? a.error / (2 * Math.sqrt(a.value - a.error)) : Infinity; break;
    case "sin": case "cos": error = a.error; break; // Both are 1-Lipschitz in radians.
    default: error = a.error; // unary sign and absolute value
  }
  return { value, error: error + rounding };
}

function compareResult(result: string, { value: expected, error: operationError }: Value): Check {
  const actual = Number(result);
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return { status: "failed" };
  if (!Number.isFinite(operationError)) return { status: "unchecked" };
  const [mantissa, exponent = "0"] = result.toLowerCase().split("e");
  const places = mantissa!.split(".")[1]?.length ?? 0;
  const rounding = mantissa!.includes(".") || result.includes("e")
    ? 0.5 * 10 ** (Number(exponent) - places) : 0;
  const tolerance = rounding + operationError + 8 * Number.EPSILON * Math.abs(actual);
  if (!Number.isFinite(tolerance) || tolerance === 0 && expected !== actual) return { status: "failed", expected };
  return { status: Math.abs(expected - actual) <= tolerance ? "passed" : "failed", expected, tolerance };
}

/** No generated code is executed. Walk a bounded arithmetic AST before evaluation. */
export function checkCalculation(line: string): Check {
  return evaluateCalculation(line).check;
}

function evaluateCalculation(line: string, prior?: Prior[]): { check: Check; canonical?: Value } {
  const sources = new Set<number>();
  const hasReference = /\bref\b/.test(line);
  const unchecked = (): { check: Check } => ({ check: {
    status: "unchecked",
    ...(hasReference ? { dependency: "Explicit dependency is invalid, unsupported or follows an unreliable calculation; only earlier checked calculations in this reply may be referenced." } : {}),
  } });
  if (line.length > 200) return unchecked();
  const parts = line.split("=");
  if (parts.length !== 2) return unchecked();
  const expression = parts[0]!.trim(), result = parts[1]!.trim();
  if (!decimal.test(result)) return unchecked();
  try {
    const ast = parseExpression(expression);
    const validate = (node: typeof ast): void => {
      if ("value" in node) {
        if (!Number.isFinite(node.value)) throw Error("Nonfinite literal");
      } else {
        if (node.name === "ref") {
          const index = node.args[0];
          if (!prior || node.args.length !== 1 || !index || !("value" in index)
            || !Number.isInteger(index.value) || index.value < 1 || index.value > 12
            || index.value > prior.length || !prior[index.value - 1]?.canonical) {
            throw Error("Invalid dependency");
          }
          sources.add(index.value);
          return;
        }
        if (!allowed.has(node.name)) throw Error("Unsupported operation");
        node.args.forEach(validate);
      }
    };
    validate(ast);
    const canonical = arithmeticValue(ast, node => {
      if ("value" in node || node.name !== "ref") return undefined;
      return prior![ (node.args[0] as { value: number }).value - 1]!.canonical!;
    });
    const check = compareResult(result, canonical);
    if (sources.size) check.dependency = `Explicit reuse of calculation(s) ${[...sources].join(", ")}; compared using their unrounded numeric values. Quantity meaning is not checked.`;
    return { check, canonical: check.status === "passed" ? canonical : undefined };
  } catch {
    // Parse errors, unknown operations and invalid domains cannot earn a pass.
    return unchecked();
  }
}

type Prior = { canonical?: Value };

// Explicit backward references form a bounded DAG. Retain every line's position,
// including invalid producers; cache values rather than expanding expressions.
function checkWithDependencies(line: string, prior: Prior[]): Check {
  const { check, canonical } = evaluateCalculation(line, prior);
  prior.push({ canonical });
  return check;
}

/** The report is persisted in the existing Markdown answer, so reloads and all
 * existing clients display the same server-owned status without schema drift. */
export function labelTutorArithmetic(answer: string, supported: boolean): string {
  const checks: Check[] = [];
  const prior: Prior[] = [];
  let omitted = false;
  if (supported) {
    for (const match of answer.matchAll(/^```arithmetic[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)) {
      for (const line of match[1]!.split(/\r?\n/).filter(line => line.trim())) {
        if (checks.length === 12) { omitted = true; break; }
        checks.push(checkWithDependencies(line, prior));
      }
      if (omitted) break;
    }
  }
  const passed = checks.filter(c => c.status === "passed").length;
  const failed = checks.filter(c => c.status === "failed").length;
  const unchecked = checks.filter(c => c.status === "unchecked").length;
  const summary = checks.length
    ? `**Arithmetic check: ${failed ? "mismatch detected" : "limited check"}.** ${passed} passed; ${failed} mismatched; ${unchecked} unchecked marked calculations.${omitted ? " Calculations beyond the first 12 were not checked." : ""}`
    : "**Arithmetic unchecked.** No supported numeric calculations were checked.";
  const details = checks.flatMap((c, i) => c.status === "failed" || c.dependency
    ? [`Calculation ${i + 1}: ${c.status === "failed" ? `${c.expected === undefined ? "nonfinite result" : `recomputed value ${c.expected.toPrecision(12)}`}. Do not rely on the displayed result. ` : ""}${c.dependency ?? ""}`] : []);
  return `${summary}\n\n${details.length ? details.join("\n\n") + "\n\n" : ""}Only calculations in arithmetic blocks are eligible for arithmetic checking. Decimal results use half the last displayed place plus floating-point tolerance; integer results use floating-point tolerance only. ref(n) explicitly reuses the unrounded value of earlier calculation n in this reply, counting nonempty lines across arithmetic blocks. Equal numeric literals do not imply reuse. Legacy numeric-only blocks receive arithmetic checks, but their dependency provenance remains unchecked. Invalid or unreliable references remain unchecked. **Unchecked:** quantity meaning, all other math, rounded input accuracy without explicit references, symbolic derivations, equation choice, physical assumptions and agreement with graphs. This is not full mathematical or physical verification.\n\n${labelTutorUnits(answer, supported, checkCalculation)}\n\n${labelTutorQuantities(answer, supported, checkCalculation)}\n\n---\n\n${answer}`;
}
