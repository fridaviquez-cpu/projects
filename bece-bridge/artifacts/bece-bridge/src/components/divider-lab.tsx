import { useId, useState } from "react";
import { DIVIDER_LIMITS, solveDivider } from "@/lib/divider";

const INK = "hsl(var(--foreground))";
const ACC = "hsl(var(--accent))";

function Resistor({ x, y, label, value, v }: { x: number; y: number; label: string; value: string; v: string }) {
  // vertical zigzag from y to y+80
  const pts = [[x, y], [x, y + 12], [x + 12, y + 18], [x - 12, y + 28], [x + 12, y + 38], [x - 12, y + 48], [x + 12, y + 58], [x, y + 64], [x, y + 80]];
  return (
    <g>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <text x={x + 24} y={y + 34} fontSize={14} fontWeight={700} fill={INK}>{label}</text>
      <text x={x + 24} y={y + 52} fontSize={12} fill={INK} fontFamily="var(--app-font-mono)">{value}</text>
      <text x={x - 22} y={y + 14} fontSize={15} fontWeight={700} fill={ACC} textAnchor="middle">+</text>
      <text x={x - 22} y={y + 76} fontSize={15} fontWeight={700} fill={ACC} textAnchor="middle">−</text>
      <text x={x + 24} y={y + 70} fontSize={12} fill={ACC} fontFamily="var(--app-font-mono)">{v}</text>
    </g>
  );
}

export function DividerSchematic({ vs, r1, r2, iMa, v1, v2, className = "" }: { vs: string; r1: string; r2: string; iMa?: string; v1?: string; v2?: string; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 360 280" role="img" aria-labelledby={`${id}-title`} className={`w-full h-auto ${className}`} data-testid="svg-divider">
      <title id={`${id}-title`}>Voltage divider: source Vs in series with R1 and R2, output V2 across R2 between node B and ground.</title>
      <defs>
        <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={ACC} /></marker>
      </defs>
      {/* wires */}
      <path d="M70 110 V40 H230 V50 M230 130 V150 M230 230 V245 H70 V170" fill="none" stroke={INK} strokeWidth={2.5} />
      {/* source */}
      <circle cx={70} cy={140} r={30} fill="hsl(var(--card))" stroke={INK} strokeWidth={2.5} />
      <text x={70} y={130} fontSize={16} fontWeight={700} textAnchor="middle" fill={INK}>+</text>
      <text x={70} y={160} fontSize={18} fontWeight={700} textAnchor="middle" fill={INK}>−</text>
      <text x={30} y={136} fontSize={14} fontWeight={700} textAnchor="end" fill={INK}>Vs</text>
      <text x={23} y={153} fontSize={12} textAnchor="middle" fill={INK} fontFamily="var(--app-font-mono)">{vs}</text>
      <Resistor x={230} y={50} label="R1" value={r1} v={v1 ? `V1 ${v1}` : "V1"} />
      <Resistor x={230} y={150} label="R2" value={r2} v={v2 ? `V2 ${v2}` : "V2"} />
      {/* current arrow */}
      <line x1={115} y1={28} x2={185} y2={28} stroke={ACC} strokeWidth={2.5} markerEnd={`url(#${id}-arrow)`} />
      <text x={150} y={20} fontSize={12} textAnchor="middle" fill={ACC} fontFamily="var(--app-font-mono)" fontWeight={600}>I {iMa ?? ""}</text>
      {/* nodes */}
      {[[70, 40, "A"], [230, 140, "B"], [70, 245, "0"]].map(([x, y, n]) => (
        <g key={n as string}>
          <circle cx={x as number} cy={y as number} r={4.5} fill={INK} />
          <text x={(x as number) - 10} y={(y as number) - 8} fontSize={13} fontWeight={700} textAnchor="end" fill={INK}>{n}</text>
        </g>
      ))}
      <circle cx={230} cy={140} r={4.5} fill={INK} />
      {/* ground */}
      <path d="M150 245 V258 M134 258 H166 M140 265 H160 M146 272 H154" stroke={INK} strokeWidth={2.5} fill="none" />
    </svg>
  );
}

const fmt = (n: number, d = 3) => Number(n.toFixed(d)).toString();

function Field({ id, label, unit, min, max, value, onChange, error }: { id: string; label: string; unit: string; min: number; max: number; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted-foreground flex justify-between"><span>{label}</span><span className="font-mono">{min} to {max} {unit}</span></label>
      <div className={`flex items-center mt-1 rounded-md border bg-background focus-within:border-accent ${error ? "border-destructive" : ""}`}>
        <input id={id} type="number" step="any" min={min} max={max} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} data-testid={`input-${id}`}
          className="flex-1 min-w-0 bg-transparent px-3 py-2 font-mono text-sm outline-none" />
        <span className="px-3 font-mono text-xs text-muted-foreground">{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={0.5} value={Number(value) || min} onChange={(e) => onChange(e.target.value)} aria-label={`${label} slider`} className="w-full mt-2 accent-[hsl(var(--accent))]" data-testid={`slider-${id}`} />
      {error && <p id={`${id}-err`} className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

export function DividerLab() {
  const [vs, setVs] = useState("12");
  const [r1, setR1] = useState("4");
  const [r2, setR2] = useState("2");
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const res = solveDivider({ vs: num(vs), r1: num(r1), r2: num(r2) });
  const errs = res.ok ? {} : res.errors;

  return (
    <section className="not-prose my-8 rounded-lg border bg-background p-5" aria-labelledby="lab-h" data-testid="section-divider-lab">
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent-ink">Interactive lab</p>
      <h3 id="lab-h" className="font-display text-xl font-semibold mt-1">Voltage divider: change the circuit, watch the equations</h3>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 mt-4">
        <div className="min-w-0 rounded-md border bg-card grid-paper p-3">
          <DividerSchematic vs={`${vs || "?"} V`} r1={`${r1 || "?"} kΩ`} r2={`${r2 || "?"} kΩ`}
            iMa={res.ok ? `${fmt(res.iMa)} mA` : undefined} v1={res.ok ? `${fmt(res.v1)} V` : undefined} v2={res.ok ? `${fmt(res.v2)} V` : undefined} />
        </div>
        <div className="space-y-3">
          <Field id="vs" label="Source Vs" unit="V" min={DIVIDER_LIMITS.vs.min} max={DIVIDER_LIMITS.vs.max} value={vs} onChange={setVs} error={errs.vs} />
          <Field id="r1" label="R1" unit="kΩ" min={DIVIDER_LIMITS.r.min} max={DIVIDER_LIMITS.r.max} value={r1} onChange={setR1} error={errs.r1} />
          <Field id="r2" label="R2" unit="kΩ" min={DIVIDER_LIMITS.r.min} max={DIVIDER_LIMITS.r.max} value={r2} onChange={setR2} error={errs.r2} />
        </div>
      </div>
      <div aria-live="polite" className="mt-5">
        {res.ok ? (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border">
            {[
              ["I", `${fmt(res.iMa)} mA`, `Vs / (R1 + R2)`, "i"],
              ["V1", `${fmt(res.v1)} V`, "I · R1", "v1"],
              ["V2", `${fmt(res.v2)} V`, "Vs · R2 / (R1 + R2)", "v2"],
              ["P", `${fmt(res.pMw)} mW`, "Vs · I", "p"],
            ].map(([k, v, eq, id]) => (
              <div key={id} className="bg-card p-3">
                <dt className="text-xs text-muted-foreground">{k} = <span className="font-mono">{eq}</span></dt>
                <dd className="font-mono text-lg font-medium mt-1" data-testid={`text-result-${id}`}>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p role="alert" className="text-sm text-destructive">Fix the highlighted inputs to see results.</p>
        )}
        <p className="text-xs text-muted-foreground mt-3">Ideal sources and resistors, no load on node B. Units: V / kΩ gives mA, V · mA gives mW. KVL check: V1 + V2 = Vs.</p>
      </div>
    </section>
  );
}
