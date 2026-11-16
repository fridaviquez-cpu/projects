import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useTimer } from "@/lib/timer";
import { fmtClock, INTENTIONS, KEYS, useLocal, type Session } from "@/lib/store";
import { btn, PageHeader } from "@/components/shell";
import { StudyCompanion } from "@/components/study-companion";
import { LengthEditor } from "@/components/focus/length-editor";
import { emptyReflection, ReflectionPanel, sameReflection, type Reflection } from "@/components/focus/reflection-panel";
import { FollowUp } from "@/components/focus/followup";
import { SessionHistory } from "@/components/focus/history";
import { cn } from "@/lib/utils";
import { clearSessionDrafts, reflectionKey, useDraft } from "@/lib/drafts";
import { methodUse } from "@/lib/content";

const prep = [
  { id: "phone", t: "Phone away: Do Not Disturb, different surface" },
  { id: "task", t: "One task, defined before you press start" },
  { id: "seat", t: "Stay in your seat until the bell" },
  { id: "break", t: "Break = doodle, walk, stretch, not scroll" },
];

const cycle = [
  { k: "Plan", d: "Build a plan", href: "/plan" },
  { k: "Focus", d: "Run the timer", href: "#timer" },
  { k: "Reflect", d: "Two questions", href: "#reflect" },
  { k: "Practice", d: "Quiz or review", href: "#practice" },
  { k: "Improve", d: "Learn the method", href: "/learn" },
];

function CycleStrip({ step }: { step: number }) {
  return (
    <nav aria-label="Study cycle" className="mb-8">
      <ol className="grid grid-cols-5 gap-1 sm:gap-2">
        {cycle.map((c, i) => {
          const cls = cn("block rounded-xl border px-2 py-2 text-center transition-colors sm:px-3 sm:text-left", i === step ? "border-[var(--gold)] bg-[var(--gold)]/15" : "border-border hover:border-[var(--gold)]/60");
          const inner = (<><span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span><span className="block text-xs font-semibold sm:text-sm">{c.k}</span><span className="hidden text-[11px] text-muted-foreground sm:block">{c.d}</span></>);
          return (
            <li key={c.k}>
              {c.href.startsWith("#")
                ? <a href={c.href} aria-current={i === step ? "step" : undefined} className={cls} data-testid={`link-cycle-${c.k.toLowerCase()}`}>{inner}</a>
                : <Link href={c.href} className={cls} data-testid={`link-cycle-${c.k.toLowerCase()}`}>{inner}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function Focus() {
  const { state, remaining, readOnly, start, pause, reset, skip, setTask, setContext } = useTimer();
  const [sessions, setSessions] = useLocal<Session[]>(KEYS.sessions, []);
  const [checks, setChecks] = useLocal<string[]>(KEYS.checklist, []);
  const [taskErr, setTaskErr] = useState("");
  const taskRef = useRef<HTMLInputElement>(null);

  const ph = state.phases[state.index];
  const total = ph.minutes * 60000;
  const progress = state.status === "done" ? 1 : 1 - remaining / total;
  const R = 120, C = 2 * Math.PI * R;
  const locked = readOnly || state.status === "running";
  const focusN = state.phases.slice(0, state.index + 1).filter((p) => p.kind === "focus").length;
  const mode = state.status === "running" ? (ph.kind === "focus" ? "focus" : "rest") : state.status === "paused" && ph.kind === "break" ? "rest" : "idle";

  // Reflection: latest unreflected session surfaces automatically (also after reload), never blocks.
  const latestOpen = sessions.find((s) => !s.reflection);
  const [dismissed, setDismissed] = useLocal<string[]>("tau.focus.dismissed.v1", []);
  const activeDraft = useDraft<string>("tau.focus.active.v1");
  const activeId = activeDraft.value;
  const setActiveId = activeDraft.set;
  const active = sessions.find((s) => s.id === activeId);
  const reflectionDraft = useDraft<Reflection>(reflectionKey(activeId ?? ""));
  const draft = reflectionDraft.value ?? emptyReflection(active);
  const setDraft = reflectionDraft.set;
  const [saveError, setSaveError] = useState("");
  const dirty = !!active && !sameReflection(draft, emptyReflection(active));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (activeId || !latestOpen || dismissed.includes(latestOpen.id) || dirtyRef.current) return;
    setActiveId(latestOpen.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions[0]?.id]);
  useEffect(() => { if (activeId && !active) setActiveId(null); }, [activeId, active]);

  const open = (id: string) => {
    if (id === activeId) { document.getElementById("reflect")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    setActiveId(id);
    setSaveError("");
    requestAnimationFrame(() => document.getElementById("reflect")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const close = () => {
    if (activeId) setDismissed((d) => [...d.filter((x) => sessions.some((s) => s.id === x)), activeId]);
    setActiveId(null);
    setSaveError("");
  };
  const save = () => {
    if (!activeId) return false;
    const r: Reflection = { recalled: draft.recalled, practiced: draft.practiced, takeaway: draft.takeaway.trim(), unclear: (draft.unclear ?? "").trim() };
    let found = false;
    const result = setSessions((prev) => prev.map((x) => {
      if (x.id !== activeId) return x;
      found = true;
      return { ...x, reflection: r };
    }));
    if (!result.ok || !found) {
      setSaveError(!result.ok ? result.error : "This session no longer exists. Copy your draft before leaving.");
      return false;
    }
    setSaveError("");
    setDraft(null);
    return true;
  };

  const onStart = () => {
    const fresh = state.status === "idle" || state.status === "done";
    if (fresh && !state.task.trim()) {
      setTaskErr("Name the one thing you're working on first.");
      taskRef.current?.focus();
      return;
    }
    setTaskErr("");
    start();
  };

  const step = mode === "focus" || mode === "rest" ? 1 : active ? (active.reflection && !dirty ? 3 : 2) : 0;
  const leoCue = active && !active.reflection ? "Nice work. When you're ready, tell me what clicked." : active?.reflection ? "Thanks for checking in. Short blocks count just as much." : undefined;

  return (
    <div>
      <PageHeader kicker="07 · Lock in" title={<>The Focus <em>Challenge.</em></>}>
        Decide what you're working on, focus, then take two minutes to notice what you learned. The timer keeps time even if you leave this page or reload.
      </PageHeader>

      <CycleStrip step={step} />

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section id="timer" className="ink-panel scroll-mt-24 rounded-3xl p-6 sm:p-8" aria-label="Focus timer">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--paper)]/60">What are you working on?</span>
              <input ref={taskRef} value={state.task} disabled={locked} required onChange={(e) => { setTask(e.target.value); if (e.target.value.trim()) setTaskErr(""); }} maxLength={120} placeholder="e.g. Problem set 4, questions 1-4"
                aria-invalid={!!taskErr} aria-describedby="task-err"
                data-testid="input-task" className={cn("mt-2 w-full border-b bg-transparent pb-2 font-display text-xl text-[var(--paper)] placeholder:text-[var(--paper)]/30 focus:border-[var(--gold)] focus:outline-none disabled:opacity-70", taskErr ? "border-[#e8947a]" : "border-white/20")} />
              <span id="task-err" role="alert" className="mt-1 block min-h-4 text-xs text-[#f0b49f]" data-testid="text-task-error">{taskErr}</span>
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--paper)]/60">Subject or course <span className="normal-case tracking-normal text-[var(--paper)]/40">(optional)</span></span>
                <input value={state.subject ?? ""} disabled={locked} onChange={(e) => setContext(e.target.value, state.intention ?? "Study")} maxLength={80} placeholder="e.g. ECE 330"
                  data-testid="input-subject" className="mt-2 w-full border-b border-white/20 bg-transparent pb-2 text-base text-[var(--paper)] placeholder:text-[var(--paper)]/30 focus:border-[var(--gold)] focus:outline-none disabled:opacity-70" />
              </label>
              <fieldset disabled={locked} className="disabled:opacity-70">
                <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--paper)]/60">Intention</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {INTENTIONS.map((it) => {
                    const on = (state.intention ?? "Study") === it;
                    return (
                      <label key={it} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--gold)]", on ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]" : "border-white/20 text-[var(--paper)]/75 hover:border-[var(--gold)]/60")}>
                        <input type="radio" name="intention" value={it} checked={on} onChange={() => setContext(state.subject ?? "", it)} className="sr-only" data-testid={`radio-intention-${it.toLowerCase()}`} />
                        {it}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            {locked && <p className="mt-2 text-[11px] text-[var(--paper)]/45">Locked while running. Pause to edit.</p>}

            <div className="relative mx-auto mt-8 grid aspect-square w-full max-w-[290px] place-items-center">
              <svg viewBox="0 0 260 260" className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="130" cy="130" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4" />
                <circle cx="130" cy="130" r={R} fill="none" stroke={ph.kind === "focus" ? "var(--gold)" : "var(--gold-soft)"} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: "stroke-dashoffset .3s linear" }} />
              </svg>
              <div className="text-center">
                <p className="font-mono text-6xl font-medium tabular-nums tracking-tight" data-testid="text-clock" aria-live="off">{fmtClock(remaining)}</p>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--gold-soft)]" data-testid="text-phase">
                  {state.status === "done" ? "Run finished" : state.status === "ready" ? "Ready for next block" : ph.kind === "focus" ? `Focus ${focusN} of 2` : "Break: step away"}
                </p>
              </div>
            </div>

            <ol className="mt-8 grid grid-cols-4 gap-1.5" aria-label="Phases">
              {state.phases.map((p, i) => (
                <li key={i} className={cn("rounded-lg px-2 py-2 text-center font-mono text-[11px] transition-colors",
                  i < state.index || state.status === "done" ? "bg-[var(--gold)]/25 text-[var(--gold-soft)]" : i === state.index ? "bg-[var(--gold)] text-[var(--ink)]" : "bg-white/5 text-[var(--paper)]/50")}>
                  {p.kind === "focus" ? "Focus" : "Break"} {p.minutes}
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {locked ? (
                <button disabled={readOnly} onClick={pause} className={btn.gold} data-testid="button-pause"><Pause className="h-4 w-4" /> Pause</button>
              ) : (
                <button disabled={readOnly} onClick={onStart} className={btn.gold} data-testid="button-start"><Play className="h-4 w-4" /> {state.status === "paused" ? "Resume" : state.status === "ready" ? "Start next block" : state.status === "done" ? "Run again" : "Start"}</button>
              )}
              <button disabled={readOnly} onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm hover:bg-white/5" data-testid="button-reset"><RotateCcw className="h-4 w-4" /> Reset</button>
              <button onClick={skip} disabled={readOnly || state.status === "done"} className="inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm text-[var(--paper)]/60 hover:text-[var(--paper)] disabled:opacity-30" data-testid="button-skip"><SkipForward className="h-4 w-4" /> Skip phase</button>
            </div>
            <p className="mt-4 text-center text-xs text-[var(--paper)]/50">Only focus phases that run to zero are logged. Skipped phases are not counted.</p>
          </section>

          <StudyCompanion sessions={sessions} mode={mode} cue={mode === "idle" ? leoCue : undefined} />
        </div>

        <div className="space-y-6">
          {active && (
            <div className="space-y-6">
              <ReflectionPanel session={active} draft={draft} onChange={setDraft} onSave={save} onCancel={() => { setDraft(null); setSaveError(""); }} onClose={close} isNew={active.id === latestOpen?.id}
                draftStored={reflectionDraft.value !== null} draftPersisted={reflectionDraft.persisted} saveError={saveError} onRetryDraft={() => setDraft(draft)} />
              <div id="practice" className="scroll-mt-24"><FollowUp key={active.id} session={active} dirty={dirty} onSaveDraft={save} /></div>
            </div>
          )}
          {!active && latestOpen && (
            <button type="button" onClick={() => open(latestOpen.id)} className="w-full rounded-2xl border border-dashed border-[var(--gold)]/60 p-4 text-left text-sm hover:bg-[var(--gold)]/5" data-testid="button-reflect-latest">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Not reflected yet</span>
              <span className="mt-1 block font-medium">{latestOpen.task}</span>
              <span className="text-xs text-muted-foreground">Open a two-question reflection when you have a minute.</span>
            </button>
          )}

          <LengthEditor />

          {state.plan && (
            <section className="rounded-2xl border border-border bg-card p-5" aria-label="Study plan" data-testid="focus-plan-context">
              <h2 className="font-display text-xl font-semibold">{state.plan.name || "Your study plan"}</h2>
              <p className="mt-3 font-medium">{state.plan.method}</p>
              <p className="mt-1 text-sm text-muted-foreground">{methodUse[state.plan.method]}</p>
              <p className="mt-3 text-sm">{state.plan.ai} · Break: {state.plan.breakStyle}</p>
              {state.plan.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm"><span className="font-medium">Plan notes: </span>{state.plan.notes}</p>}
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Before you start</h2>
              <span className="font-mono text-xs text-muted-foreground">{checks.length}/4</span></div>
            <ul className="mt-3 space-y-2">
              {prep.map((p) => {
                const on = checks.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-secondary">
                      <input type="checkbox" checked={on} onChange={() => setChecks(on ? checks.filter((c) => c !== p.id) : [...checks, p.id])} className="h-4 w-4 accent-[#d4af37]" data-testid={`checkbox-prep-${p.id}`} />
                      <span className={cn("text-sm transition-colors", on && "text-muted-foreground line-through")}>{p.t}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <SessionHistory sessions={sessions} activeId={activeId} onOpen={open}
            onDelete={(id) => {
              if (!confirm("Delete this session and its saved reflection? This cannot be undone.")) return;
              if (setSessions((prev) => prev.filter((x) => x.id !== id)).ok) {
                clearSessionDrafts(id);
                if (activeId === id) setActiveId(null);
              }
            }}
            onClear={() => { if (confirm("Clear all completed sessions and saved reflections from this device? This cannot be undone.") && setSessions([]).ok) { sessions.forEach(s => clearSessionDrafts(s.id)); setActiveId(null); } }} />
        </div>
      </div>
    </div>
  );
}
