import { useId, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SIGNAL_LIMITS, SIGNAL_SAMPLES, sampleSignal } from "@/lib/signal";

const fmt = (n: number, d = 3) => Number(n.toFixed(d)).toString();

function Field({ id, label, unit, min, max, step, value, onChange, error }: { id: string; label: string; unit: string; min: number; max: number; step: number; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted-foreground flex justify-between"><span>{label}</span><span className="font-mono">{min} to {max} {unit}</span></label>
      <div className={`flex items-center mt-1 rounded-md border bg-background focus-within:border-accent ${error ? "border-destructive" : ""}`}>
        <input id={id} type="number" step="any" min={min} max={max} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} data-testid={`input-${id}`}
          className="flex-1 min-w-0 bg-transparent px-3 py-2 font-mono text-sm outline-none" />
        <span className="px-3 font-mono text-xs text-muted-foreground">{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={Number.isFinite(Number(value)) && value.trim() !== "" ? Number(value) : min} onChange={(e) => onChange(e.target.value)} aria-label={`${label} slider`} className="w-full mt-2 accent-[hsl(var(--accent))]" data-testid={`slider-${id}`} />
      {error && <p id={`${id}-err`} className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

/** Serializes the rendered chart SVG (numeric samples only) and downloads it. */
function exportSvg(host: HTMLElement | null, name: string) {
  const svg = host?.querySelector("svg.recharts-surface");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const css = getComputedStyle(document.documentElement);
  const resolve = (v: string) => v.replace(/hsl\(var\(--([a-z-]+)\)\)/g, (_, k: string) => `hsl(${css.getPropertyValue(`--${k}`).trim().split(/\s+/).join(", ")})`).replace(/var\(--app-font-mono\)/g, "monospace");
  clone.querySelectorAll("*").forEach((el) => {
    for (const attr of ["stroke", "fill", "font-family"]) { const v = el.getAttribute(attr); if (v) el.setAttribute(attr, resolve(v)); }
  });
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SignalExplorer({ eyebrow = "ECE 210 supplemental · not scored" }: { eyebrow?: string } = {}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const h = useId();
  const desc = useId();
  const [a, setA] = useState("3");
  const [f, setF] = useState("2");
  const [ph, setPh] = useState("0");
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const input = { a: num(a), f: num(f), phase: num(ph) };
  const res = useMemo(() => sampleSignal(input), [input.a, input.f, input.phase]);
  const errs = res.ok ? {} : res.errors;

  return (
    <section className="rounded-lg border bg-card p-5 md:p-6" aria-labelledby={h} data-testid="section-signal-explorer">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-accent">{eyebrow}</p>
        <span className="font-mono text-[11px] text-muted-foreground">Exploration only, not part of pilot checks</span>
      </div>
      <h2 id={h} className="font-display text-2xl font-semibold mt-1">Signal explorer</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-prose">v(t) = A · sin(2π f t + φ). Change amplitude, frequency, and phase and watch the sinusoid over one second.</p>
      <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-6 mt-5">
        <div className="space-y-3">
          <Field id="sig-a" label="Amplitude A" unit="V" min={SIGNAL_LIMITS.a.min} max={SIGNAL_LIMITS.a.max} step={0.1} value={a} onChange={setA} error={errs.a} />
          <Field id="sig-f" label="Frequency f" unit="Hz" min={SIGNAL_LIMITS.f.min} max={SIGNAL_LIMITS.f.max} step={0.5} value={f} onChange={setF} error={errs.f} />
          <Field id="sig-phase" label="Phase φ" unit="deg" min={SIGNAL_LIMITS.phase.min} max={SIGNAL_LIMITS.phase.max} step={5} value={ph} onChange={setPh} error={errs.phase} />
        </div>
        <div className="min-w-0">
          <p id={desc} className="sr-only" aria-live="polite">
            {res.ok ? `Line chart of voltage in volts versus time in seconds from 0 to 1 second, ${SIGNAL_SAMPLES} samples. Sinusoid with amplitude ${fmt(input.a)} volts, frequency ${fmt(input.f)} hertz, period ${fmt(res.periodS)} seconds, phase ${fmt(input.phase)} degrees. Vertical axis fixed from minus 5 to plus 5 volts.` : "Chart unavailable until inputs are valid."}
          </p>
          {res.ok ? (
            <div ref={chartRef} role="img" aria-labelledby={h} aria-describedby={desc} className="h-72 rounded-md border bg-background grid-paper p-2" data-testid="chart-signal">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={res.points} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="t" type="number" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tick={{ fontSize: 11, fontFamily: "var(--app-font-mono)", fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "Time (s)", position: "insideBottom", offset: -14, fontSize: 12, fill: "hsl(var(--foreground))" }} />
                  <YAxis type="number" domain={[-5, 5]} ticks={[-5, -2.5, 0, 2.5, 5]} allowDataOverflow tick={{ fontSize: 11, fontFamily: "var(--app-font-mono)", fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "Voltage (V)", angle: -90, position: "insideLeft", fontSize: 12, fill: "hsl(var(--foreground))" }} width={52} />
                  <Tooltip formatter={(v: number) => [`${fmt(v)} V`, "v(t)"]} labelFormatter={(t: number) => `t = ${fmt(t, 4)} s`}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontFamily: "var(--app-font-mono)", fontSize: 12 }} />
                  <Line type="linear" dataKey="v" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p role="alert" className="h-72 grid place-items-center rounded-md border bg-background text-sm text-destructive">Fix the highlighted inputs to draw the signal.</p>}
          {res.ok && (
            <button type="button" onClick={() => exportSvg(chartRef.current, `signal-A${fmt(input.a)}V-f${fmt(input.f)}Hz-phi${fmt(input.phase)}deg.svg`)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent" data-testid="button-export-signal-svg">
              <Download className="h-3.5 w-3.5" /> Export graph as SVG
            </button>
          )}
          {res.ok && (
            <dl className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden border mt-3 text-sm">
              <div className="bg-card p-2"><dt className="text-xs text-muted-foreground">Period T = 1/f</dt><dd className="font-mono" data-testid="text-signal-period">{fmt(res.periodS)} s</dd></div>
              <div className="bg-card p-2"><dt className="text-xs text-muted-foreground">Peak-to-peak</dt><dd className="font-mono" data-testid="text-signal-pp">{fmt(2 * input.a)} V</dd></div>
              <div className="bg-card p-2"><dt className="text-xs text-muted-foreground">Cycles shown</dt><dd className="font-mono" data-testid="text-signal-cycles">{fmt(input.f)}</dd></div>
            </dl>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">Ideal continuous sinusoid with no DC offset or noise, computed from the formula and drawn from {SIGNAL_SAMPLES} evenly spaced samples (2.5 ms step, at least 40 per cycle at 10 Hz).</p>
    </section>
  );
}
