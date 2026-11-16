// Run: npx tsx src/lib/visual-math.test.ts
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
const { createElement } = React;
// tsx uses the classic JSX runtime here; expose React for the component under test.
(globalThis as { React?: typeof React }).React = React;
import { decompose, expressionToTex, freeN, parseMath } from "./visual-math";
import { RecipeEquations, TeX } from "../components/recipe-equations";

const t = (e: string) => { const r = expressionToTex(e); if ("error" in r) throw new Error(r.error); return r.tex; };
const cases: [string, string][] = [
  ["-2^2", "-2^{2}"],
  ["(-2)^2", "\\left(-2\\right)^{2}"],
  ["(a+b)*c", "\\left(a + b\\right) \\cdot c"],
  ["a+b*c", "a + b \\cdot c"],
  ["a-(b-c)", "a - \\left(b - c\\right)"],
  ["a-b-c", "a - b - c"],
  ["1/(1+x)", "\\frac{1}{1 + x}"],
  ["(a/b)^2", "\\left(\\frac{a}{b}\\right)^{2}"],
  ["2^3^2", "2^{3^{2}}"],
  ["sum(N, cos(2*pi*f*n), 0)", "\\sum_{n=0}^{N - 1} \\cos\\left(2 \\cdot \\pi \\cdot f \\cdot n\\right)"],
  ["sum(4, n, 1)", "\\sum_{n=1}^{4} n"],
  ["sqrt(x)", "\\sqrt{x}"],
  ["fft(cos(n), 8, x)", "\\left|\\,\\mathrm{FFT}_{8}\\left\\{\\cos\\left(n\\right)\\right\\}\\left[x\\right]\\,\\right|"],
  ["if(lt(x,0), 0, x)", "\\begin{cases} 0 & \\text{if } x < 0 \\\\ x & \\text{otherwise} \\end{cases}"],
  ["omega_0*x", "\\omega_{\\mathrm{0}} \\cdot x"],
  ["1.5e-3*x", "1.5 \\times 10^{-3} \\cdot x"],
];
for (const [e, want] of cases) assert.equal(t(e), want, e);
// -2^2 parses as neg(2^2), matching the server interpreter.
assert.deepEqual(parseMath("-2^2"), { name: "neg", args: [{ name: "^", args: [{ value: 2, raw: "2" }, { value: 2, raw: "2" }] }] });
assert.ok("error" in expressionToTex("alert('x')"));
assert.ok("error" in expressionToTex("a.b"));
assert.ok("error" in expressionToTex("(1+2"));
const html = renderToStaticMarkup(createElement(TeX, { tex: t("1/(1+x)"), display: true }));
assert.ok(html.includes("<math") && html.includes("mfrac"), "renders MathML fraction");

// ---- Decomposition semantics ----
let extra = 0;
const ok = (c: unknown, msg: string) => { assert.ok(c, msg); extra++; };
ok(freeN(parseMath("n*x")), "free n");
ok(!freeN(parseMath("sum(4, n, 0)")), "sum binds n");
ok(freeN(parseMath("sum(n, 1, 0)")), "n in sum count is free");
ok(!freeN(parseMath("fft(n, 8, x)")), "fft binds n");

const dtft = "sqrt(sum(len,cos(2*pi*f0*n)*cos(2*pi*x*n),0)^2+sum(len,cos(2*pi*f0*n)*sin(2*pi*x*n),0)^2)";
const s1 = decompose(parseMath(dtft));
const kinds = s1.map((s) => s.kind);
ok(kinds.filter((k) => k === "sum").length === 2, "two sums extracted");
ok(s1.filter((s) => s.kind === "sequence").every((s) => s.symbol.endsWith("[n]")), "n-dependent terms are indexed by n");
ok(s1.filter((s) => s.kind === "sum").every((s) => !s.symbol.includes("[n]")), "sums are not indexed by n");
ok(s1.every((s) => s.kind !== "shared" || !s.vars.includes("n")), "no n-dependent term hoisted as a plain shared value");
const last = s1[s1.length - 1]!;
ok(last.final && /^\\sqrt\{A\^\{2\} \+ B\^\{2\}\}$/.test(last.tex), "final is sqrt(A^2+B^2): " + last.tex);
ok(/magnitude/.test(last.description), "magnitude description");
ok(s1.every((s) => s.tex.length < 120), "every step is compact");
// The expanded final step must reproduce the full original formula exactly.
ok((() => { const r = expressionToTex(dtft); return "tex" in r && last.fullTex === r.tex; })(), "expanded steps equal the original formula");

const fftExpr = "fft(if(lt(n,len),cos(2*pi*f0*n),0),2^ceil(log2(len)+padding),x*2^ceil(log2(len)+padding))";
const s2 = decompose(parseMath(fftExpr));
const fstep = s2.find((s) => s.kind === "fft")!;
ok(fstep && fstep.final, "fft step is the plotted value");
ok(/magnitude only, not the complex value/.test(fstep.description), "fft labelled magnitude");
ok(s2.some((s) => s.kind === "shared" && s.tex.includes("\\lceil")), "repeated N extracted once");
const seq = s2.find((s) => s.kind === "sequence")!;
ok(seq && seq.tex.includes("\\begin{cases}") && seq.symbol.endsWith("[n]"), "if kept intact as an n-sequence");
ok((() => { const r = expressionToTex(fftExpr); return "tex" in r && fstep.fullTex === r.tex; })(), "fft expansion exact");

// Nothing extracted from inside lazy if branches, even if repeated.
const lazy = decompose(parseMath("if(lt(x,1), sqrt(x*x*x+1)+sqrt(x*x*x+1), 0)"));
ok(lazy.length === 1 && lazy[0]!.final, "if branches not decomposed");
// Simple formula stays one step.
ok(decompose(parseMath("cos(2*pi*f0*x)")).length === 1, "simple formula is one step");
// Labels from controls; no invented meanings.
const html2 = renderToStaticMarkup(createElement(RecipeEquations, {
  recipe: { title: "t", explanation: "", assumptions: "", controls: [], plots: [{ title: "Spectrum", xLabel: "Frequency (cycles/sample)", yLabel: "Mag", curves: [{ name: "DTFT magnitude", expression: dtft, min: "0", max: "1", samples: "3", mode: "line" }] }] },
  panels: [{ title: "Spectrum", xLabel: "Frequency (cycles/sample)", yLabel: "Mag", series: [{ name: "DTFT magnitude", mode: "line", points: [{ x: 0, y: 1 }, { x: 0.5, y: 2 }, { x: 1, y: 1 }] }] }],
  controls: [{ key: "len", label: "Observed sample count L", unit: "samples", min: 8, max: 64, step: 1, value: 24 }, { key: "f0", label: "Sinusoid frequency f0", unit: "cycles/sample", min: 0, max: 1, step: 0.001, value: 0.173 }],
}));
ok(html2.includes("Observed sample count L") && html2.includes("= 24 samples"), "control label/unit/value shown");
ok(html2.includes("Sum over n") && html2.includes("Plotted value"), "step headings rendered");
ok(html2.includes("x from 0 to 1, 3 points"), "range from plotted points");
ok(html2.includes("Advanced: full equation and calculation code"), "advanced disclosure present");
ok(!/<details[^>]*open/.test(html2), "advanced disclosure closed by default");
console.log(`visual-math: ${cases.length + 5 + extra} checks passed`);
