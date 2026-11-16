import { useEffect, useRef, useState } from "react";
import { useTimer } from "@/lib/timer";
import { btn } from "@/components/shell";
import { cn } from "@/lib/utils";

const presets = [
  { f: 25, b: 5, l: "Short and sharp" },
  { f: 50, b: 10, l: "Deep work" },
  { f: 90, b: 15, l: "Long project" },
];

const validInt = (v: string, max: number) => /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= max;

export function LengthEditor() {
  const { state, configure, readOnly } = useTimer();
  const curF = state.duration;
  const curB = state.phases[1]?.minutes ?? 5;
  const locked = readOnly || state.status === "running";
  const isPreset = presets.some((p) => p.f === curF && p.b === curB);
  const [custom, setCustom] = useState(!isPreset);
  const [f, setF] = useState(String(curF));
  const [b, setB] = useState(String(curB));
  const [msg, setMsg] = useState("");
  const focusRef = useRef<HTMLInputElement>(null);
  const wantFocus = useRef(false);
  useEffect(() => { setF(String(curF)); setB(String(curB)); }, [curF, curB]);
  useEffect(() => { if (custom && wantFocus.current) { wantFocus.current = false; focusRef.current?.focus(); } }, [custom]);

  const fErr = validInt(f, 180) ? "" : "Whole minutes, 1 to 180.";
  const bErr = validInt(b, 60) ? "" : "Whole minutes, 1 to 60.";
  const dirty = Number(f) !== curF || Number(b) !== curB;

  const apply = (fm: number, bm: number) => {
    if (locked) return false;
    const ok = configure(fm, bm);
    setMsg(ok ? `Set to ${fm} min focus, ${bm} min break.` : "Couldn't apply. Pause the timer and check the values.");
    return ok;
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="len-h">
      <h2 id="len-h" className="font-display text-xl font-semibold">Session lengths</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Quick presets">
        {presets.map((p) => {
          const on = !custom && curF === p.f && curB === p.b;
          return (
            <button key={p.f} type="button" disabled={locked} aria-pressed={on} onClick={() => { if (apply(p.f, p.b)) setCustom(false); }} data-testid={`button-preset-${p.f}`}
              className={cn("rounded-xl border p-3 text-left transition-all active:scale-95 disabled:opacity-50", on ? "border-[var(--gold)] bg-[var(--gold)]/15" : "border-border hover:border-[var(--gold)]/60")}>
              <span className="font-display block text-xl font-semibold">{p.f}<span className="text-sm text-muted-foreground">/{p.b}</span></span>
              <span className="text-[11px] text-muted-foreground">{p.l}</span>
            </button>
          );
        })}
        <button type="button" disabled={locked} aria-pressed={custom} aria-expanded={custom} aria-controls="custom-lengths"
          onClick={() => { wantFocus.current = true; setCustom(true); if (custom) focusRef.current?.focus(); }} data-testid="button-preset-custom"
          className={cn("rounded-xl border p-3 text-left transition-all active:scale-95 disabled:opacity-50", custom ? "border-[var(--gold)] bg-[var(--gold)]/15" : "border-border hover:border-[var(--gold)]/60")}>
          <span className="font-display block text-xl font-semibold">Custom</span>
          <span className="text-[11px] text-muted-foreground">{custom ? `${curF}/${curB} now` : "Your own split"}</span>
        </button>
      </div>
      {custom && (
        <form id="custom-lengths" className="rise mt-4 grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (!fErr && !bErr) apply(Number(f), Number(b)); }}>
          {[
            { id: "focus", label: "Focus (min)", v: f, set: setF, err: fErr, max: 180, ref: focusRef },
            { id: "break", label: "Break (min)", v: b, set: setB, err: bErr, max: 60, ref: undefined },
          ].map((x) => (
            <label key={x.id} className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{x.label}</span>
              <input ref={x.ref} type="number" inputMode="numeric" min={1} max={x.max} step={1} value={x.v} disabled={locked}
                onChange={(e) => { x.set(e.target.value); setMsg(""); }} aria-invalid={!!x.err} aria-describedby={`err-${x.id}`} data-testid={`input-${x.id}-minutes`}
                className={cn("mt-1 w-full rounded-lg border bg-background px-3 py-2 font-mono text-lg tabular-nums focus:border-[var(--gold)] focus:outline-none disabled:opacity-50", x.err ? "border-destructive" : "border-input")} />
              <span id={`err-${x.id}`} className="mt-1 block min-h-4 text-[11px] text-destructive">{x.err}</span>
            </label>
          ))}
          <button type="submit" disabled={locked || !!fErr || !!bErr || !dirty} className={cn(btn.gold, "col-span-2 justify-center sm:col-span-1 sm:mt-5")} data-testid="button-apply-lengths">Apply</button>
        </form>
      )}
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite" data-testid="text-length-status">
        {locked ? "Pause or reset to change lengths." : msg || "Every length counts the same. Pick what fits the task, not what looks impressive."}
      </p>
    </section>
  );
}
