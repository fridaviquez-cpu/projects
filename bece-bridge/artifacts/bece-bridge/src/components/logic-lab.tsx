import { useId, useState } from "react";
import { GATES, evalGate, truthTable, type Bit, type Gate } from "@/lib/logic";

function BitToggle({ label, value, onChange }: { label: string; value: Bit; onChange: (b: Bit) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value === 1} aria-label={`Input ${label}`} onClick={() => onChange(value ? 0 : 1)} data-testid={`toggle-input-${label.toLowerCase()}`}
      className={`w-20 rounded-md border px-3 py-2 font-mono text-sm text-left transition-colors ${value ? "bg-accent text-accent-foreground border-accent" : "bg-card hover:bg-secondary"}`}>
      {label} = {value}
    </button>
  );
}

export function LogicLab() {
  const h = useId();
  const [gate, setGate] = useState<Gate>("AND");
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(0);
  const out = evalGate(gate, a, b);
  const unary = gate === "NOT";
  return (
    <section className="rounded-lg border bg-card p-5 md:p-6" aria-labelledby={h} data-testid="section-logic-lab">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-chart-3">ECE 120 supplemental · not scored</p>
        <span className="font-mono text-[11px] text-muted-foreground">Not part of the ECE 210 pilot checks</span>
      </div>
      <h2 id={h} className="font-display text-2xl font-semibold mt-1">Logic gate lab</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-prose">Ideal binary gates: inputs are exactly 0 or 1, no propagation delay, no voltage thresholds.</p>
      <div role="radiogroup" aria-label="Gate" className="flex flex-wrap gap-2 mt-4">
        {GATES.map((g) => (
          <button key={g} type="button" role="radio" aria-checked={gate === g} onClick={() => setGate(g)} data-testid={`button-gate-${g.toLowerCase()}`}
            className={`rounded-md border px-3 py-1.5 font-mono text-sm ${gate === g ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-secondary"}`}>{g}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <BitToggle label="A" value={a} onChange={setA} />
            {!unary && <BitToggle label="B" value={b} onChange={setB} />}
          </div>
          <div className="font-mono text-sm rounded-md border-2 border-foreground px-4 py-3 bg-background">{gate}</div>
          <div aria-live="polite" className={`font-mono text-2xl font-semibold rounded-md px-4 py-2 ${out ? "bg-accent/15 text-accent" : "bg-secondary"}`} data-testid="text-gate-output">Y = {out}</div>
        </div>
        <table className="w-full font-mono text-sm border rounded-md overflow-hidden" data-testid="table-truth">
          <caption className="sr-only">{gate} truth table</caption>
          <thead className="bg-secondary"><tr><th className="p-2 text-left">A</th>{!unary && <th className="p-2 text-left">B</th>}<th className="p-2 text-left">Y</th></tr></thead>
          <tbody>
            {truthTable(gate).map((r) => {
              const hit = r.a === a && (unary || r.b === b);
              return <tr key={`${r.a}${r.b}`} className={`border-t ${hit ? "bg-accent/10" : ""}`} aria-current={hit ? "true" : undefined}><td className="p-2">{r.a}</td>{!unary && <td className="p-2">{r.b}</td>}<td className="p-2 font-semibold">{r.out}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
