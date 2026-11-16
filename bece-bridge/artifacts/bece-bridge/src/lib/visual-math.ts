// Deterministic, display-only conversion of visual recipe expressions to LaTeX.
// Grammar mirrors the server interpreter (api-server/src/lib/visual-expressions.ts).
// No eval, no Function, no evaluation of user text. Identifiers are restricted to [A-Za-z0-9_].

export type MathNode = { name: string; args: MathNode[] } | { value: number; raw: string };

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };

export function parseMath(text: string): MathNode {
  if (text.length > 800) throw new Error("Expression is too long.");
  const tokens = text.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-zA-Z][a-zA-Z0-9_]*|[()+\-*/^,]/g) ?? [];
  if (tokens.join("") !== text.replace(/\s/g, "") || tokens.length > 300) throw new Error("Unsupported characters.");
  let i = 0, depth = 0;
  const expr = (min = 0): MathNode => {
    if (++depth > 30) throw new Error("Nesting too deep.");
    const t = tokens[i++];
    let left: MathNode;
    if (t === "-" || t === "+") left = { name: t === "-" ? "neg" : "pos", args: [expr(3)] };
    else if (t === "(") { left = expr(); if (tokens[i++] !== ")") throw new Error("Missing closing parenthesis."); }
    else if (t && /^\d|^\./.test(t)) left = { value: Number(t), raw: t };
    else if (t && /^[a-zA-Z]/.test(t)) {
      const args: MathNode[] = [];
      if (tokens[i] === "(") {
        i++;
        if (tokens[i] !== ")") { for (;;) { args.push(expr()); if (tokens[i] !== ",") break; i++; } }
        if (tokens[i++] !== ")") throw new Error("Missing closing parenthesis.");
      }
      left = { name: t, args };
    } else throw new Error("Invalid expression.");
    while (i < tokens.length) {
      const op = tokens[i]!, p = PREC[op];
      if (p === undefined || p < min) break;
      i++;
      left = { name: op, args: [left, expr(p + (op === "^" ? 0 : 1))] };
    }
    depth--;
    return left;
  };
  const root = expr();
  if (i !== tokens.length) throw new Error("Unexpected token.");
  return root;
}

const GREEK = new Set(["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "lambda", "mu", "nu", "xi", "rho", "sigma", "tau", "phi", "chi", "psi", "omega", "Gamma", "Delta", "Theta", "Lambda", "Sigma", "Phi", "Psi", "Omega"]);

export function identTex(name: string): string {
  if (name === "pi") return "\\pi";
  const [base, ...rest] = name.split("_");
  const b = GREEK.has(base!) ? `\\${base}` : base!.length === 1 ? base! : `\\mathrm{${base}}`;
  return rest.length && rest.join("") ? `${b}_{\\mathrm{${rest.join("\\_")}}}` : b;
}

function numTex(raw: string): string {
  const m = raw.match(/^(\d*\.?\d+)e([+-]?\d+)$/);
  return m ? `${m[1]} \\times 10^{${Number(m[2])}}` : raw;
}

type Out = { tex: string; prec: number };
const ATOM = 5;
const paren = (s: string) => `\\left(${s}\\right)`;
const wrap = (o: Out, need: number) => (o.prec < need ? paren(o.tex) : o.tex);
const FN: Record<string, string> = { sin: "\\sin", cos: "\\cos", tan: "\\tan", exp: "\\exp", log: "\\ln", log2: "\\log_2", min: "\\min", max: "\\max" };

function cond(node: MathNode): string {
  if ("name" in node && (node.name === "lt" || node.name === "eq") && node.args.length === 2) {
    return `${tex(node.args[0]!).tex} ${node.name === "lt" ? "<" : "="} ${tex(node.args[1]!).tex}`;
  }
  return `${tex(node).tex} \\neq 0`;
}

function tex(node: MathNode): Out {
  if ("value" in node) return { tex: numTex(node.raw), prec: ATOM };
  const { name, args } = node;
  const a = args.map(tex);
  if (!args.length) return { tex: name.startsWith("__") ? (REFS[name] ?? "?") : identTex(name), prec: ATOM };
  switch (name) {
    case "+": return { tex: `${wrap(a[0]!, 1)} + ${wrap(a[1]!, 2)}`, prec: 1 };
    case "-": return { tex: `${wrap(a[0]!, 1)} - ${wrap(a[1]!, 2)}`, prec: 1 };
    case "*": return { tex: `${wrap(a[0]!, 2)} \\cdot ${a[1]!.prec <= 3 && a[1]!.prec !== 2.5 ? paren(a[1]!.tex) : a[1]!.tex}`, prec: 2 };
    case "/": return { tex: `\\frac{${a[0]!.tex}}{${a[1]!.tex}}`, prec: 2.5 };
    case "^": return { tex: `${wrap(a[0]!, ATOM)}^{${a[1]!.tex}}`, prec: 4 };
    case "neg": return { tex: `-${wrap(a[0]!, 2.5)}`, prec: 3 };
    case "pos": return { tex: `+${wrap(a[0]!, 2.5)}`, prec: 3 };
    case "sqrt": if (args.length === 1) return { tex: `\\sqrt{${a[0]!.tex}}`, prec: ATOM }; break;
    case "abs": if (args.length === 1) return { tex: `\\left|${a[0]!.tex}\\right|`, prec: ATOM }; break;
    case "floor": if (args.length === 1) return { tex: `\\left\\lfloor ${a[0]!.tex}\\right\\rfloor`, prec: ATOM }; break;
    case "ceil": if (args.length === 1) return { tex: `\\left\\lceil ${a[0]!.tex}\\right\\rceil`, prec: ATOM }; break;
    case "lt": case "eq":
      if (args.length === 2) return { tex: `\\left[${cond(node)}\\right]`, prec: ATOM }; break;
    case "if":
      if (args.length === 3) return { tex: `\\begin{cases} ${a[1]!.tex} & \\text{if } ${cond(args[0]!)} \\\\ ${a[2]!.tex} & \\text{otherwise} \\end{cases}`, prec: ATOM };
      break;
    case "sum":
      if (args.length === 3) {
        const [count, body, start] = args as [MathNode, MathNode, MathNode];
        const upper = "value" in count && "value" in start
          ? String(start.value + count.value - 1)
          : "value" in start && start.value === 0
            ? tex({ name: "-", args: [count, { value: 1, raw: "1" }] }).tex
            : tex({ name: "-", args: [{ name: "+", args: [start, count] }, { value: 1, raw: "1" }] }).tex;
        return { tex: `\\sum_{n=${a[2]!.tex}}^{${upper}} ${wrap(a[1]!, 2)}`, prec: 2 };
      }
      break;
    case "fft":
      if (args.length === 3) return { tex: `\\left|\\,\\mathrm{FFT}_{${a[1]!.tex}}\\left\\{${a[0]!.tex}\\right\\}\\left[${a[2]!.tex}\\right]\\,\\right|`, prec: ATOM };
      break;
  }
  const fn = FN[name] ?? `\\operatorname{${name.replace(/_/g, "\\_")}}`;
  return { tex: `${fn}${paren(a.map((x) => x.tex).join(",\\ "))}`, prec: ATOM };
}

let REFS: Record<string, string> = {};
/** refs maps internal step references (names starting with "__", impossible in user text) to their symbol TeX. */
export function toTex(node: MathNode, refs: Record<string, string> = {}): string {
  const prev = REFS; REFS = refs;
  try { return tex(node).tex; } finally { REFS = prev; }
}

/** Identifiers used as variables (zero-arg names), and whether sum/fft appear. */
export function analyze(node: MathNode) {
  const vars = new Set<string>();
  let usesSum = false, usesFft = false;
  const walk = (n: MathNode) => {
    if ("value" in n) return;
    if (!n.args.length) { if (n.name !== "pi" && n.name !== "e") vars.add(n.name); return; }
    if (n.name === "sum") usesSum = true;
    if (n.name === "fft") usesFft = true;
    n.args.forEach(walk);
  };
  walk(node);
  return { vars, usesSum, usesFft };
}

export function expressionToTex(expr: string): { tex: string; node: MathNode } | { error: string } {
  try { const node = parseMath(expr); return { tex: toTex(node), node }; }
  catch (e) { return { error: e instanceof Error ? e.message : "Could not parse." }; }
}

// ---------------------------------------------------------------------------
// Deterministic step decomposition for display.
// Steps are *definitions* (functions of x, and of n where n is free), never hoisted values:
// a subterm that uses a sum/FFT-local n is shown as a sequence a[n], defined for each n.
// Nothing is extracted from inside if(...) branches, so lazy cases stay intact.

export type StepKind = "shared" | "sequence" | "sum" | "fft" | "part" | "result";
export type Step = {
  id: string;
  kind: StepKind;
  symbol: string;      // TeX for the step's name, e.g. "A" or "a[n]"
  tex: string;         // compact TeX of the definition (uses earlier step symbols)
  fullTex: string;     // same definition with every reference expanded
  vars: string[];      // user variables referenced directly by this step (x, n, control keys)
  description: string; // plain-language description of the operation, from structure only
  final?: boolean;     // this step's value is what gets plotted
};

const key = (n: MathNode): string => ("value" in n ? n.raw : `${n.name}(${n.args.map(key).join(",")})`);
const size = (n: MathNode): number => ("value" in n ? 1 : 1 + n.args.reduce((s, a) => s + size(a), 0));
const isLeaf = (n: MathNode) => "value" in n || !n.args.length;

/** True when n appears free (not bound by an enclosing sum/fft inside this node). */
export function freeN(node: MathNode): boolean {
  if ("value" in node) return false;
  if (!node.args.length) return node.name === "n";
  if ((node.name === "sum" || node.name === "fft") && node.args.length === 3) {
    const [a, , c] = node.args as [MathNode, MathNode, MathNode];
    return node.name === "sum" ? freeN(a) || freeN(c) : freeN(node.args[1]!) || freeN(c);
  }
  return node.args.some(freeN);
}

function directVars(node: MathNode, out = new Set<string>()): Set<string> {
  if ("value" in node) return out;
  if (!node.args.length) { if (!node.name.startsWith("__") && node.name !== "pi" && node.name !== "e") out.add(node.name); return out; }
  node.args.forEach((a) => directVars(a, out));
  return out;
}

function describe(kind: StepKind, node: MathNode): string {
  if ("value" in node) return "Constant value.";
  const { name, args } = node;
  if (kind === "sum") return "Add one term for each sample index n over the range shown. n only exists inside this sum.";
  if (kind === "fft") return "Run an N-point FFT on the input sequence and keep the magnitude of one bin (magnitude only, not the complex value). n only exists inside the FFT.";
  if (kind === "shared") return "A value that appears more than once, computed once here and reused below.";
  if (kind === "sequence") return name === "if" ? "A sequence defined for each sample index n. Only the case that matches is used." : "A term defined for each sample index n.";
  if (name === "sqrt" && args.length === 1) {
    const inner = args[0]!;
    if ("name" in inner && inner.name === "+" && inner.args.every((t) => "name" in t && t.name === "^" && "value" in t.args[1]! && t.args[1].value === 2)) return "Combine the parts as a magnitude: square root of the sum of their squares.";
    return "Take the square root.";
  }
  const lead = kind === "result" ? "The plotted value: " : "";
  const verb: Record<string, string> = { "+": "add the parts", "-": "subtract", "*": "multiply the factors", "/": "divide", "^": "raise to a power", neg: "negate", abs: "take the absolute value", exp: "apply the exponential", log: "take the natural log", log2: "take the base-2 log", sin: "apply sine", cos: "apply cosine", tan: "apply tangent", if: "pick the case that matches", min: "take the smaller value", max: "take the larger value", floor: "round down", ceil: "round up" };
  const v = verb[name];
  return v ? `${lead}${v}.` : kind === "result" ? "The plotted value at each x." : "An intermediate value.";
}

export function decompose(root: MathNode): Step[] {
  const counts = new Map<string, number>();
  const tally = (n: MathNode, inIf: boolean) => {
    if (isLeaf(n) || "value" in n) return;
    if (!inIf && size(n) >= 6) counts.set(key(n), (counts.get(key(n)) ?? 0) + 1);
    n.args.forEach((a, i) => tally(a, inIf || (n.name === "if" && i > 0)));
  };
  tally(root, false);

  const steps: Step[] = [];
  const refs: Record<string, string> = {};
  const full: Record<string, MathNode> = {};
  const byKey = new Map<string, string>();
  const upper = ["A", "B", "C", "D", "F", "G", "H", "J", "K", "M", "P", "Q", "R", "S", "T", "U", "V", "W", "Y", "Z"];
  const lower = ["a", "b", "c", "d", "g", "h", "p", "q", "r", "s", "u", "v", "w", "y", "z"];
  const used = directVars(root);
  let ui = 0, li = 0;
  const nextSym = (seq: boolean) => {
    if (seq) { while (li < lower.length && used.has(lower[li]!)) li++; return li < lower.length ? lower[li++]! : `a_{${li++}}`; }
    while (ui < upper.length && used.has(upper[ui]!)) ui++;
    return ui < upper.length ? upper[ui++]! : `A_{${ui++}}`;
  };
  const expand = (n: MathNode): MathNode => ("value" in n ? n : !n.args.length && n.name.startsWith("__") ? full[n.name]! : { name: n.name, args: n.args.map(expand) });
  const define = (node: MathNode, kind: StepKind, origKey: string): MathNode => {
    const seq = freeN(expand(node));
    const k = seq && kind !== "sum" && kind !== "fft" ? "sequence" : kind;
    const base = nextSym(seq);
    const symbol = seq ? `${base}[n]` : base;
    const id = `__s${steps.length}`;
    steps.push({ id, kind: k, symbol, tex: toTex(node, refs), fullTex: toTex(expand(node), refs), vars: [...directVars(node)], description: describe(k, node) });
    refs[id] = symbol;
    full[id] = expand(node);
    byKey.set(origKey, id);
    return { name: id, args: [] };
  };

  // noCse: inside a repeated subtree, only its maximal form is shared (no nested fragments).
  const build = (n: MathNode, inIf: boolean, noCse = false): MathNode => {
    if ("value" in n || !n.args.length) return n;
    const k = key(n);
    if (!inIf && byKey.has(k)) return { name: byKey.get(k)!, args: [] };
    const repeated = !inIf && !noCse && (counts.get(k) ?? 0) >= 2;
    let args = n.args.map((a, i) => build(a, inIf || (n.name === "if" && i > 0), noCse || repeated));
    if ((n.name === "fft" || n.name === "sum") && args.length === 3) {
      const bi = n.name === "fft" ? 0 : 1;
      const body = args[bi]!;
      if (!inIf && !isLeaf(body) && toTex(body, refs).length > 40) {
        args = args.map((a, i) => (i === bi ? define(a, "sequence", key(n.args[bi]!) + "#body") : a));
      }
    }
    const out: MathNode = { name: n.name, args };
    if (inIf) return out;
    if (repeated) return define(out, "shared", k);
    if (n.name === "sum" || n.name === "fft") return define(out, n.name, k);
    return out;
  };

  let finalNode = build(root, false);
  // Keep the final formula short: pull out its largest non-trivial child until compact.
  for (let guard = 0; guard < 6 && toTex(finalNode, refs).length > 90 && "name" in finalNode && finalNode.name !== "if"; guard++) {
    let best = -1, bestSize = 2;
    const kids = finalNode.args;
    kids.forEach((c, i) => { const s = size(c); if (!isLeaf(c) && s > bestSize) { best = i; bestSize = s; } });
    if (best < 0) break;
    const target = kids[best]!;
    const cand = "name" in target && target.args.length && (target.name === "+" || target.name === "-" || target.name === "*") ? target : target;
    const id = define(cand, "part", `part${guard}`);
    finalNode = { name: finalNode.name, args: kids.map((c, i) => (i === best ? id : c)) };
  }
  const last = steps[steps.length - 1];
  if (last && "name" in finalNode && finalNode.name === last.id) { last.final = true; return steps; }
  steps.push({ final: true, id: "__result", kind: "result", symbol: "y", tex: toTex(finalNode, refs), fullTex: toTex(expand(finalNode)), vars: [...directVars(finalNode)], description: describe("result", "name" in finalNode && finalNode.name.startsWith("__") ? (full[finalNode.name] ?? finalNode) : finalNode) });
  return steps;
}
