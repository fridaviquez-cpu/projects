import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "@/hooks/use-personalization";
import { wealthPrefill } from "@/lib/personalize";
import { AlertTriangle, Info, Target } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/kit";
import { money0 } from "@/lib/money";

function Control({ id, label, value, min, max, step, onChange, fmt }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-sm">{label}</label>
        <Input id={id} type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))} className="num h-8 w-28 bg-background text-right" data-testid={`input-${id}`} aria-describedby={`${id}-v`} />
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
      <p id={`${id}-v`} className="sr-only">{fmt(value)}</p>
    </div>
  );
}

export default function Wealth() {
  const [start, setStart] = useState(1000);
  const [monthly, setMonthly] = useState(150);
  const [rate, setRate] = useState(5);
  const [years, setYears] = useState(25);
  const { prefs } = usePrefs();
  const fill = wealthPrefill(prefs);
  const touched = useRef(false);
  const prefilled = useRef(false);
  const [usedPrefill, setUsedPrefill] = useState(false);
  // Apply the horizon-derived years once, and only before any manual edit. The rate is never derived from answers.
  useEffect(() => {
    if (prefilled.current || touched.current || !prefs) return;
    prefilled.current = true;
    if (fill.years != null) { setYears(Math.min(50, Math.max(1, fill.years))); setUsedPrefill(true); }
  }, [prefs, fill.years]);
  const manual = <T,>(set: (v: T) => void) => (v: T) => { touched.current = true; setUsedPrefill(false); set(v); };

  const rows = useMemo(() => {
    const r = rate / 100 / 12;
    let bal = start * 100, contrib = start * 100;
    const out = [{ year: 0, bal, contrib }];
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) { bal = bal * (1 + r) + monthly * 100; contrib += monthly * 100; }
      out.push({ year: y, bal: Math.round(bal), contrib });
    }
    return out;
  }, [start, monthly, rate, years]);
  const last = rows[rows.length - 1];
  const max = Math.max(1, last.bal);
  const W = 600, H = 240;
  const x = (y: number) => (years ? (y / years) * W : 0);
  const y = (v: number) => H - (v / max) * H;
  const balPath = rows.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.bal)}`).join(" ");
  const conPath = rows.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.contrib)}`).join(" ");

  return (
    <div>
      <PageHeader eyebrow="Wealth sketch" title="How steady habits compound." lede="An arithmetic illustration with a constant rate you choose. Real returns vary year to year and can be negative. This is not a forecast." />
      {(fill.goalLabel || usedPrefill || fill.shortHorizon) && (
        <div className="rise mb-6 space-y-2" data-testid="panel-wealth-context">
          {(fill.goalLabel || usedPrefill) && <p className="flex items-start gap-2 text-sm text-muted-foreground"><Target className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>{fill.goalLabel && <>Framed around your goal: <span className="font-medium text-foreground">{fill.goalLabel}</span>. </>}{usedPrefill && <>Years start at {years} from your time horizon answer; change them freely.</>}</span></p>}
          {fill.shortHorizon && <p className="flex items-start gap-2 rounded-lg border-l-[3px] border-accent bg-accent/5 p-3 text-sm" data-testid="text-short-horizon-caveat"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />You said you may need this money within five years. Over short spans, markets can fall and not recover in time, so a smooth curve like this one is especially misleading. Many people keep near-term money in steadier places.</p>}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="paper space-y-6 p-6">
          <Control id="start" label="Starting amount ($)" value={start} min={0} max={500000} step={100} onChange={manual(setStart)} fmt={(n) => `$${n}`} />
          <Control id="monthly" label="Added each month ($)" value={monthly} min={0} max={10000} step={10} onChange={manual(setMonthly)} fmt={(n) => `$${n}`} />
          <Control id="rate" label="Assumed yearly rate (%)" value={rate} min={0} max={12} step={0.5} onChange={manual(setRate)} fmt={(n) => `${n}%`} />
          <div>
            <Control id="years" label="Years" value={years} min={1} max={50} step={1} onChange={manual((value: number) => setYears(Math.round(value)))} fmt={(n) => `${n} years`} />
            <p className="mt-2 text-xs text-muted-foreground">Whole years only; fractional entries round to the nearest year.</p>
          </div>
        </section>
        <section className="paper p-6">
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-xs text-muted-foreground">Illustrated balance</p><p className="num mt-1 text-2xl" data-testid="text-final-balance">{money0(last.bal)}</p></div>
            <div><p className="text-xs text-muted-foreground">You put in</p><p className="num mt-1 text-2xl">{money0(last.contrib)}</p></div>
            <div><p className="text-xs text-muted-foreground">Growth on growth</p><p className="num mt-1 text-2xl text-accent">{money0(last.bal - last.contrib)}</p></div>
          </div>
          <svg viewBox={`-4 -8 ${W + 8} ${H + 16}`} className="mt-6 h-auto w-full" role="img" aria-label={`Illustration: ${money0(last.bal)} after ${years} years at a constant ${rate}%`}>
            {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="hsl(var(--border))" strokeDasharray="3 5" />)}
            <path d={`${balPath} L${W},${H} L0,${H} Z`} fill="hsl(var(--accent) / .12)" />
            <path d={balPath} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" />
            <path d={conPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="5 4" />
          </svg>
          <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-accent" />Balance at a constant {rate}%</span>
            <span className="flex items-center gap-2"><span className="h-0.5 w-5 border-t border-dashed border-primary" />Total contributed</span>
          </div>
          <p className="mt-5 flex gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Computed in your browser, not saved, ignores fees, taxes and inflation. Nothing here uses your holdings or predicts markets.</p>
        </section>
      </div>
    </div>
  );
}
