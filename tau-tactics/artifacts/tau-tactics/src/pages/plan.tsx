import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Pencil, Play, RotateCcw, Save, Trash2 } from "lucide-react";
import { durations, planAI, planBreaks, planMethods, protocol, quiz, quizTypes, tactics, typeOrder } from "@/lib/content";
import { KEYS, useLocal, type Plan, type QuizResult } from "@/lib/store";
import { breakFor, useTimer } from "@/lib/timer";
import { validLengths } from "@/lib/timer-core";
import { btn, CopyButton, DeviceNote, PageHeader } from "@/components/shell";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Draft = { duration: number; breakMinutes?: number; ai: string; method: string; breakStyle: string; notes: string; name: string; task: string };
const empty: Draft = { duration: 30, ai: "No AI this session", method: "", breakStyle: "", notes: "", name: "", task: "" };

function Choice({ n, q, opts, value, onPick }: { n: string; q: string; opts: { v: string; l: string; s?: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="font-medium"><span className="mr-2 font-mono text-xs text-gold">{n}</span>{q}</legend>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {opts.map((o) => (
          <button type="button" key={o.v} aria-pressed={value === o.v} onClick={() => onPick(o.v)} data-testid={`button-choice-${n}-${o.v.replace(/\W+/g, "-").toLowerCase()}`}
            className={cn("rounded-xl border p-3 text-left text-sm transition-all active:scale-[.97]", value === o.v ? "border-[var(--gold)] bg-[var(--gold)]/15 font-medium" : "border-border bg-card hover:border-[var(--gold)]/60")}>
            {o.l}{o.s && <span className="block text-[11px] font-normal text-muted-foreground">{o.s}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function PlanPage() {
  const [plans, setPlans] = useLocal<Plan[]>(KEYS.plans, []);
  const [result, setResult] = useLocal<QuizResult | null>(KEYS.quiz, null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const timer = useTimer();
  const [, nav] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (window.location.hash === "#quiz") document.getElementById("quiz")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const lengthsValid = validLengths(draft.duration, draft.breakMinutes ?? breakFor(draft.duration));
  const ready = draft.ai && draft.method && draft.breakStyle && lengthsValid;
  const text = ready ? protocol(draft) : "";

  const save = () => {
    if (!ready) return;
    const name = draft.name.trim() || `${draft.duration}-min ${draft.method}`;
    const result = editing
      ? setPlans((previous) => previous.map((p) => (p.id === editing ? { ...p, ...draft, name } : p)))
      : setPlans((previous) => [{ id: crypto.randomUUID(), ...draft, name, createdAt: Date.now() }, ...previous]);
    if (!result.ok) {
      setSaveError("Could not save this plan on this device. Your saved plans have not changed. Your inputs are still here; copy your plan before leaving or reloading, or free browser storage and try again.");
      return;
    }
    setSaveError("");
    if (editing) {
      toast({ title: "Plan updated", description: "Saved on this device." });
    } else {
      toast({ title: "Plan saved", description: "Saved on this device." });
    }
    setEditing(null);
  };
  const remove = (p: Plan) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const result = setPlans((previous) => previous.filter((x) => x.id !== p.id));
    if (!result.ok) {
      setDeleteError(`Could not delete "${p.name}" on this device. Your saved plans have not changed. Free browser storage or allow storage access, then try deleting again.`);
      return;
    }
    setDeleteError("");
    // Keep any open inputs, but do not continue editing a record that no longer exists.
    if (editing === p.id) setEditing(null);
    toast({ title: "Plan deleted", description: "Removed from this device." });
  };
  const run = (d: number) => {
    if (timer.setDuration(d)) nav("/focus");
  };
  const runPlan = (p: Plan | Draft) => {
    if (timer.applyPlan(p)) nav("/focus");
  };
  const edit = (p: Plan) => {
    setSaveError("");
    setDraft({ duration: p.duration, breakMinutes: p.breakMinutes, ai: p.ai, method: p.method, breakStyle: p.breakStyle, notes: p.notes, name: p.name, task: p.task ?? "" });
    setEditing(p.id);
    setGenerated(true);
    document.getElementById("builder")?.scrollIntoView({ behavior: "smooth" });
  };

  const finishQuiz = (all: number[]) => {
    const counts = [0, 0, 0, 0];
    const scoring = [[0, 1, 2, 3], [1, 1, 0, 3], [2, 0, 1, 3], [1, 0, 2, 3], [1, 2, 0, 3]];
    all.forEach((a, question) => counts[scoring[question][a]]++);
    const max = Math.max(...counts);
    const idx = counts.indexOf(max);
    setResult({ type: typeOrder[idx], answers: all, takenAt: Date.now() });
  };
  const answer = (i: number) => {
    const next = [...answers, i];
    setAnswers(next);
    if (next.length === quiz.length) finishQuiz(next);
  };
  const qType = result ? quizTypes[result.type] : null;

  return (
    <div>
      <PageHeader kicker="04 · Make it yours" title={<>Build your <em>study system.</em></>}>
        Four choices. One personalized protocol. Pick what fits how you actually work, then copy it, save it, or run it with the timer.
      </PageHeader>

      <section id="builder" className="space-y-7 rounded-3xl border border-border bg-card/60 p-5 sm:p-7">
        <Choice n="01" q="How long can you realistically focus right now?" value={draft.breakMinutes === undefined ? String(draft.duration) : ""} onPick={(v) => setDraft({ ...draft, duration: Number(v), breakMinutes: undefined })}
          opts={durations.map((d) => ({ v: String(d.v), l: `${d.v} min`, s: `${d.l} · ${breakFor(d.v)} min break` }))} />
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Or customize your intervals</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Focus minutes
              <input type="number" min={1} max={180} step={1} value={draft.duration || ""}
                onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
                aria-describedby="plan-length-help" aria-invalid={!validLengths(draft.duration, 5)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" data-testid="input-plan-focus-minutes" />
            </label>
            <label className="text-sm">Break minutes (optional)
              <input type="number" min={1} max={60} step={1} value={draft.breakMinutes ?? ""}
                placeholder={String(breakFor(draft.duration))}
                onChange={(e) => setDraft({ ...draft, breakMinutes: e.target.value === "" ? undefined : Number(e.target.value) })}
                aria-describedby="plan-length-help" aria-invalid={!validLengths(25, draft.breakMinutes ?? breakFor(draft.duration))}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" data-testid="input-plan-break-minutes" />
            </label>
          </div>
          <p id="plan-length-help" className="text-xs text-muted-foreground">Use whole minutes: focus 1–180, break 1–60. Leave break blank for the suggested length. Choosing a preset resets both intervals.</p>
          {!lengthsValid && <p role="alert" className="text-sm text-destructive">Enter a valid focus and break length before building, saving, copying, or opening this plan.</p>}
        </fieldset>
        <Choice n="02" q="AI support, if any?" value={draft.ai} onPick={(v) => setDraft({ ...draft, ai: v })} opts={planAI.map((v) => ({ v, l: v }))} />
        <Choice n="03" q="Focus method?" value={draft.method} onPick={(v) => setDraft({ ...draft, method: v })} opts={planMethods.map((v) => ({ v, l: v }))} />
        <Choice n="04" q="Break strategy?" value={draft.breakStyle} onPick={(v) => setDraft({ ...draft, breakStyle: v })} opts={planBreaks.map((v) => ({ v, l: v }))} />
        <button className={btn.gold} disabled={!ready} onClick={() => setGenerated(true)} data-testid="button-generate-plan">Build my Tau Tactics plan</button>
        <p className="text-xs text-muted-foreground">Built from your choices on this device, not generated by AI.</p>
        {!ready && <p className="text-xs text-muted-foreground">Make all four choices to generate.</p>}
      </section>

      {generated && ready && (
        <section className="rise mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="ink-panel rounded-2xl p-5">
            <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Your protocol</p><CopyButton text={text} testId="button-copy-plan" label="Copy plan" className="border-white/20 bg-transparent text-[var(--paper)]" /></div>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-[var(--paper)]/85" data-testid="text-protocol">{text}</pre>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <label className="block text-sm"><span className="text-xs text-muted-foreground">Task for Focus (optional)</span>
              <input value={draft.task} maxLength={120} onChange={(e) => setDraft({ ...draft, task: e.target.value })} placeholder="e.g. Practice integration, questions 1–4" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" data-testid="input-plan-task" /></label>
            <label className="block text-sm"><span className="text-xs text-muted-foreground">Plan name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={`${draft.duration}-min ${draft.method}`} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" data-testid="input-plan-name" /></label>
            <label className="block text-sm"><span className="text-xs text-muted-foreground">Your own notes (added to the plan)</span>
              <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} placeholder="e.g. Tue/Thu at Grainger, after lab" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" data-testid="input-plan-notes" /></label>
            <div className="flex flex-wrap gap-2">
              <button onClick={save} className={btn.primary} data-testid="button-save-plan"><Save className="h-4 w-4" /> {editing ? "Update plan" : "Save plan"}</button>
              <button disabled={timer.readOnly} onClick={() => runPlan(draft)} className={btn.ghost} data-testid="button-run-plan"><Play className="h-4 w-4" /> Open in Focus</button>
              {editing && <button onClick={() => { setEditing(null); setDraft(empty); setGenerated(false); setSaveError(""); }} className="text-sm text-muted-foreground underline" data-testid="button-cancel-edit">Cancel edit</button>}
            </div>
            {saveError && <p role="alert" className="text-sm text-destructive" data-testid="plan-save-error">{saveError}</p>}
            <DeviceNote />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Saved plans</h2>
        {deleteError && <p role="alert" className="mt-3 text-sm text-destructive" data-testid="plan-delete-error">{deleteError}</p>}
        {plans.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No saved plans yet. Generate one above and keep it here for the nights you need it.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <li key={p.id} className="lift rounded-2xl border border-border bg-card p-4" data-testid={`card-plan-${p.id}`}>
                <p className="font-display text-lg font-semibold">{p.name}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.duration}/{p.breakMinutes ?? breakFor(p.duration)} · {p.ai} · {p.breakStyle} · {format(p.createdAt, "MMM d")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={timer.readOnly} onClick={() => runPlan(p)} className={btn.ghost} data-testid={`button-run-${p.id}`}><Play className="h-3.5 w-3.5" /> Open in Focus</button>
                  <CopyButton text={protocol(p)} testId={`button-copy-${p.id}`} />
                  <button onClick={() => edit(p)} className={btn.ghost} data-testid={`button-edit-${p.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => remove(p)} aria-label={`Delete plan ${p.name}`} className={`${btn.ghost} icon-action`} data-testid={`button-delete-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="quiz" className="mt-16 scroll-mt-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">05 · Know yourself</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">What type of <em>student</em> are you?</h2>
        <p className="mt-2 text-muted-foreground">Five honest questions. No wrong answers, just an accurate read on your habits and the tactics that fit.</p>

        {result && qType && (answers.length === 0 || answers.length === quiz.length) ? (
          <div className="ink-panel rise mt-6 rounded-3xl p-6 sm:p-8" data-testid="card-quiz-result">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Your result · {format(result.takenAt, "MMM d")}</p>
            <p className="font-display mt-2 text-4xl font-semibold">{qType.name}</p>
            <p className="mt-2 max-w-xl text-[var(--paper)]/75">{qType.summary}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {qType.tactics.map((id) => { const t = tactics.find((x) => x.id === id)!; return (
                <div key={id} className="rounded-xl border border-white/10 p-4"><p className="font-medium text-[var(--gold-soft)]">{t.name}</p><p className="mt-1 text-sm text-[var(--paper)]/70">{t.how}</p></div>
              ); })}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => run(qType.duration)} className={btn.gold} data-testid="button-run-result">Start with {qType.duration} minutes</button>
              <button onClick={() => { setAnswers([]); setResult(null); }} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5" data-testid="button-retake"><RotateCcw className="h-4 w-4" /> Retake</button>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-border bg-card p-6">
            <div className="flex gap-1">{quiz.map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < answers.length ? "bg-[var(--gold)]" : "bg-secondary")} />)}</div>
            {answers.length < quiz.length && (
              <div key={answers.length} className="rise mt-5">
                <p className="font-mono text-xs text-muted-foreground">Question {answers.length + 1} of {quiz.length}</p>
                <p className="font-display mt-1 text-2xl font-semibold">{quiz[answers.length].q}</p>
                <div className="mt-4 grid gap-2">
                  {quiz[answers.length].a.map((a, i) => (
                    <button key={i} onClick={() => answer(i)} className="lift rounded-xl border border-border p-4 text-left text-sm hover:border-[var(--gold)]" data-testid={`button-answer-${i}`}>{a}</button>
                  ))}
                </div>
                {answers.length > 0 && <button onClick={() => setAnswers(answers.slice(0, -1))} className="mt-3 text-sm text-muted-foreground underline" data-testid="button-quiz-back">Back</button>}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
