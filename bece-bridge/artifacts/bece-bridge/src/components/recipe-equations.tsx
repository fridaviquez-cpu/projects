import { Fragment, useMemo, useState } from "react";
import katex from "katex";
import { ArrowRight } from "lucide-react";
import type { VisualControl, VisualCurveRecipe, VisualPanel, VisualRecipe } from "@workspace/api-client-react";
import { decompose, expressionToTex, identTex, type Step, type StepKind } from "@/lib/visual-math";

/** KaTeX render of LaTeX we generated ourselves from a parsed AST (identifiers restricted, trust disabled). */
export function TeX({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: "ignore", maxSize: 20, maxExpand: 50, output: "htmlAndMathml" }), [tex, display]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const fmt = (n: number) => (Math.abs(n) >= 1e4 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(3) : Number(n.toFixed(4)).toString());
const LONG_STEP = 170;

export const STEP_HEADING: Record<StepKind, string> = {
  shared: "Shared value", sequence: "Term for each n", sum: "Sum over n", fft: "FFT magnitude", part: "Intermediate value", result: "Plotted value",
};

/** Consecutive identical step kinds collapse into one chip, e.g. "Sum over n ×2". */
function flow(steps: Step[]) {
  const out: { label: string; count: number }[] = [];
  for (const s of steps) {
    const label = s.final ? "Plotted value" : STEP_HEADING[s.kind];
    const last = out[out.length - 1];
    if (last && last.label === label) last.count++; else out.push({ label, count: 1 });
  }
  return out;
}

function VarList({ vars, controls, xLabel, seen }: { vars: string[]; controls: VisualControl[]; xLabel: string; seen: Set<string> }) {
  if (!vars.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Values used in this step">
      {vars.map((v) => {
        const c = controls.find((k) => k.key === v);
        const first = !seen.has(v);
        seen.add(v);
        const text = c ? `= ${fmt(c.value)}${c.unit ? ` ${c.unit}` : ""}${first ? ` · ${c.label}` : ""}`
          : v === "x" ? (first ? `· ${xLabel} (horizontal axis)` : "· horizontal axis")
          : v === "n" ? "· sample index, local to this step"
          : "· variable from the recipe";
        return (
          <li key={v} className="inline-flex items-baseline gap-1 rounded-md border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] text-foreground/80" data-testid={`chip-var-${v}`}>
            <TeX tex={identTex(v)} /><span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function StepItem({ step, index, controls, xLabel, seen, id }: { step: Step; index: number; controls: VisualControl[]; xLabel: string; seen: Set<string>; id: string }) {
  const long = step.tex.length > LONG_STEP;
  const [open, setOpen] = useState(false);
  const final = !!step.final;
  const symbol = final ? "y" : step.symbol;
  return (
    <li className="relative pl-9" data-testid={`step-${id}-${index}`}>
      <span aria-hidden className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${final ? "bg-accent text-accent-foreground" : "border border-primary/30 bg-card text-primary"}`}>{index + 1}</span>
      <p className="text-xs font-semibold"><span className={final ? "text-accent-ink" : "text-primary"}>{final ? "Plotted value" : STEP_HEADING[step.kind]}</span></p>
      <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
      {(!long || open) ? (
        <div className={`mt-2 max-w-full overflow-x-auto rounded-md border px-3 py-2 text-sm ${final ? "border-accent/40 bg-accent/5" : "bg-card"}`} data-testid={`step-math-${id}-${index}`}>
          <TeX tex={`\\displaystyle ${symbol} = ${step.tex}`} />
        </div>
      ) : null}
      {long && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1 text-[11px] text-primary underline" data-testid={`button-step-math-${id}-${index}`}>{open ? "Hide the math for this step" : "Show the math for this step"}</button>}
      <VarList vars={step.vars} controls={controls} xLabel={xLabel} seen={seen} />
    </li>
  );
}

export function CurveSteps({ curve, panel, seriesIndex, xLabel, controls, id }: { curve: VisualCurveRecipe; panel?: VisualPanel; seriesIndex: number; xLabel: string; controls: VisualControl[]; id: string }) {
  const parsed = useMemo(() => expressionToTex(curve.expression), [curve.expression]);
  const steps = useMemo(() => ("node" in parsed ? decompose(parsed.node) : []), [parsed]);
  const pts = panel?.series[seriesIndex]?.points ?? [];
  const xs = pts.map((q) => q.x);
  const seen = new Set<string>();
  const discrete = curve.mode === "points";
  return (
    <article className="min-w-0 rounded-lg border bg-card/60 p-3 sm:p-4" data-testid={`curve-equation-${id}`}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h5 className="text-sm font-semibold break-words">{curve.name}</h5>
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${discrete ? "bg-accent/10 text-accent-ink" : "bg-primary/10 text-primary"}`}>{discrete ? "Discrete samples" : "Continuous curve"}</span>
      </header>
      {pts.length > 0 && <p className="mt-1 text-xs text-muted-foreground" data-testid={`text-curve-range-${id}`}>Plotted for x from {fmt(Math.min(...xs))} to {fmt(Math.max(...xs))}, {pts.length} {discrete ? "samples" : "points"}.</p>}
      {"error" in parsed ? (
        <p className="mt-2 text-xs text-muted-foreground">This formula could not be broken into steps ({parsed.error}). The exact code is below.</p>
      ) : (
        <>
          {steps.length > 1 && (
            <ol className="mt-3 flex flex-wrap items-center gap-1 text-[11px]" aria-label="Calculation outline" data-testid={`flow-${id}`}>
              {flow(steps).map((f, i) => (
                <Fragment key={i}>
                  {i > 0 && <ArrowRight aria-hidden className="h-3 w-3 text-muted-foreground" />}
                  <li className={`rounded-full px-2 py-0.5 ${f.label === "Plotted value" ? "bg-accent/15 text-accent-ink" : "bg-primary/10 text-primary"}`}>{f.label}{f.count > 1 ? ` ×${f.count}` : ""}</li>
                </Fragment>
              ))}
            </ol>
          )}
          <ol className="mt-4 space-y-4" data-testid={`steps-${id}`}>
            {steps.map((s, i) => <StepItem key={s.id} step={s} index={i} controls={controls} xLabel={xLabel} seen={seen} id={id} />)}
          </ol>
        </>
      )}
      <details className="mt-4 border-t pt-3" data-testid={`details-code-${id}`}>
        <summary className="cursor-pointer text-[11px] text-muted-foreground">Advanced: full equation and calculation code</summary>
        {"tex" in parsed && (
          <div className="mt-2 max-h-56 max-w-full overflow-auto rounded bg-muted/50 px-2 text-sm" tabIndex={0} aria-label="Full equation, scrollable" data-testid={`equation-${id}`}>
            <TeX display tex={`y = ${parsed.tex}`} />
          </div>
        )}
        <code className="mt-2 block max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap break-all text-[11px]">{curve.expression}</code>
        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">x min: {curve.min} · x max: {curve.max} · samples: {curve.samples}</p>
        {controls.length > 0 && <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">Current values: {controls.map((c) => `${c.key}=${c.value}`).join(", ")}</p>}
      </details>
    </article>
  );
}

export function RecipeEquations({ recipe, panels, controls }: { recipe: VisualRecipe; panels?: VisualPanel[]; controls: VisualControl[] }) {
  return (
    <ul className="mt-3 space-y-6" data-testid="list-recipe-formulas">
      {recipe.plots.map((p, i) => (
        <li key={i} className="min-w-0">
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Plot {i + 1} · <span className="normal-case tracking-normal font-sans font-semibold text-foreground">{p.title}</span></h4>
          <div className="mt-2 space-y-3">
            {p.curves.map((cv, j) => <CurveSteps key={j} curve={cv} panel={panels?.[i]} seriesIndex={j} xLabel={panels?.[i]?.xLabel ?? p.xLabel} controls={controls} id={`${i}-${j}`} />)}
          </div>
        </li>
      ))}
    </ul>
  );
}
