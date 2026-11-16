import { useId, useState } from "react";
import { OHM_LIMITS, solveOhm } from "@/lib/ohm";

const fmt = (n: number, d = 3) => Number(n.toFixed(d)).toString();

function NumField({ id, label, unit, min, max, step, value, onChange, error }: { id: string; label: string; unit: string; min: number; max: number; step: number; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted-foreground flex justify-between"><span>{label}</span><span className="font-mono">{min} to {max} {unit}</span></label>
      <div className={`flex items-center mt-1 rounded-md border bg-background focus-within:border-accent ${error ? "border-destructive" : ""}`}>
        <input id={id} type="number" step="any" min={min} max={max} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} data-testid={`input-${id}`}
          className="flex-1 min-w-0 bg-transparent px-3 py-2 font-mono text-sm outline-none" />
        <span className="px-3 font-mono text-xs text-muted-foreground">{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={Number(value) || min} onChange={(e) => onChange(e.target.value)} aria-label={`${label} slider`} className="w-full mt-2 accent-[hsl(var(--accent))]" data-testid={`slider-${id}`} />
      {error && <p id={`${id}-err`} className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

export function OhmLab() {
  const h = useId();
  const [v, setV] = useState("9");
  const [r, setR] = useState("3");
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const res = solveOhm({ v: num(v), rK: num(r) });
  const errs = res.ok ? {} : res.errors;
  const fill = res.ok ? Math.min(1, res.iMa / 20) : 0;
  return (
    <section className="not-prose my-8 rounded-lg border bg-background p-5" aria-labelledby={h} data-testid="section-ohm-lab">
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent">Interactive lab · Ohm's law</p>
      <h3 id={h} className="font-display text-xl font-semibold mt-1">One resistor: V = I · R, P = V · I</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <div className="space-y-3">
          <NumField id="ohm-v" label="Voltage V" unit="V" min={OHM_LIMITS.v.min} max={OHM_LIMITS.v.max} step={0.5} value={v} onChange={setV} error={errs.v} />
          <NumField id="ohm-r" label="Resistance R" unit="kΩ" min={OHM_LIMITS.r.min} max={OHM_LIMITS.r.max} step={0.1} value={r} onChange={setR} error={errs.rK} />
        </div>
        <div aria-live="polite" className="rounded-md border bg-card grid-paper p-4 flex flex-col justify-between">
          {res.ok ? (
            <dl className="space-y-3">
              <div><dt className="text-xs text-muted-foreground">I = <span className="font-mono">V / R</span></dt><dd className="font-mono text-2xl font-medium" data-testid="text-ohm-i">{fmt(res.iMa)} mA</dd></div>
              <div><dt className="text-xs text-muted-foreground">P = <span className="font-mono">V · I = V² / R</span></dt><dd className="font-mono text-2xl font-medium" data-testid="text-ohm-p">{fmt(res.pMw)} mW</dd></div>
            </dl>
          ) : <p role="alert" className="text-sm text-destructive">Fix the highlighted inputs to see results.</p>}
          <div className="mt-4" aria-hidden="true">
            <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-accent origin-left transition-transform duration-300" style={{ transform: `scaleX(${fill})` }} /></div>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">current, 0 to 20 mA scale</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">Ideal linear resistor, ideal source, no temperature drift or power rating limit. Units: V / kΩ gives mA, V · mA gives mW.</p>
    </section>
  );
}
