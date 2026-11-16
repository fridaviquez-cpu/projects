import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, Lightbulb, ArrowRight } from "lucide-react";
import {
  useListLessons, getListLessonsQueryKey,
  getGetJourneyQueryKey, getGetBridgeSummaryQueryKey,
  type AssessmentInputMode,
} from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { useCheckDraft } from "@/hooks/use-check-draft";
import { DividerLab } from "@/components/divider-lab";
import { OhmLab } from "@/components/ohm-lab";
import { LogicLab } from "@/components/logic-lab";
import { SignalExplorer } from "@/components/signal-explorer";
import { ErrorState, Empty, Markdown, PageHead, Skel, Sources, btnAccent, btnGhost, btnPrimary } from "@/components/kit";

const MODES: { mode: AssessmentInputMode; label: string; note: string }[] = [
  { mode: "diagnostic", label: "Diagnostic", note: "Find where to start" },
  { mode: "practice", label: "Practice", note: "Work the ideas" },
  { mode: "recheck", label: "Recheck", note: "Confirm it stuck" },
];

export default function Learn() {
  const search = useSearch();
  const courseId = new URLSearchParams(search).get("course") ?? "210";
  return <CourseChecks key={courseId} courseId={courseId} />;
}

function CourseChecks({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const lessons = useListLessons({ query: { queryKey: getListLessonsQueryKey(), enabled: true } });
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const { draft, assessment, answers, result, busy, ready, message, storageWarning,
    begin: startCheck, resume, discard, changeAnswer, send } = useCheckDraft(courseId, () => {
    qc.invalidateQueries({ queryKey: getGetJourneyQueryKey() });
    qc.invalidateQueries({ queryKey: getGetBridgeSummaryQueryKey() });
  });
  const courseLessons = lessons.data?.filter(l => l.courseId === courseId);

  const current = courseLessons?.find((l) => l.id === lessonId) ?? courseLessons?.[0];

  const begin = (mode: AssessmentInputMode) => {
    setHints({}); startCheck(mode);
    document.getElementById("check")?.scrollIntoView({ behavior: "smooth" });
  };
  const openLesson = (id: string) => { setLessonId(id); document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth" }); };
  const allFilled = assessment?.questions.every((q) => answers[q.id]?.trim() && Number.isFinite(Number(answers[q.id])));

  if (!["110","120","210","220"].includes(courseId)) return <Empty title="No scored coverage for this course"><Link href="/learn">Choose a supported course</Link></Empty>;

  return (
    <div>
      <PageHead eyebrow={`ECE ${courseId} diagnostics`} title={<>Diagnose. Learn. <span className="text-accent-ink">Recheck.</span></>}>
        Three focused skills per course, with code-calculated reference answers and original targeted lessons. These checks are not instructor-reviewed and do not measure full course mastery. Round fractional answers to at least two decimal places.
      </PageHead>
      <nav aria-label="Assessment course" className="flex flex-wrap gap-3 mb-6">
        {["110","120","210","220"].map(id=><Link key={id} href={`/learn?course=${id}`} className={id===courseId?btnAccent:btnGhost}>ECE {id}</Link>)}
        <Link href={`/journey?course=${courseId}`} className={btnGhost}>View course progress</Link>
      </nav>

      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border mb-12">
        {MODES.map((m, i) => (
          <li key={m.mode} className="bg-card">
            <button onClick={() => begin(m.mode)} disabled={busy || !ready || !!draft} data-testid={`button-start-${m.mode}`}
              className="w-full text-left p-5 hover:bg-secondary/60 transition-colors group disabled:opacity-60">
              <span className="font-mono text-xs text-accent-ink">0{i + 1}</span>
              <span className="block font-display text-xl font-semibold mt-1">{m.label}</span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">{m.note} <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" /></span>
            </button>
          </li>
        ))}
      </ol>

      <section id="check" className="scroll-mt-24 mb-14">
        {storageWarning && <p role="alert" className="mb-4 text-sm text-destructive">{storageWarning}</p>}
        {message && <p role="alert" className="mb-4 text-sm text-destructive">{message}</p>}
        {draft && !result && <div className="rounded-lg border bg-card p-5 mb-5" data-testid="draft-notice">
          <h2 className="font-display text-xl font-semibold">Unfinished ECE {courseId} check</h2>
          <p className="text-sm text-muted-foreground my-2">Answers are saved only in this browser, separately for each course. Discard permanently removes this unfinished check.</p>
          <div className="flex gap-3">
            {!assessment && <button onClick={resume} disabled={busy} className={btnPrimary} data-testid="button-resume">Resume check</button>}
            <button onClick={discard} disabled={busy} className={btnGhost} data-testid="button-discard">Discard check</button>
          </div>
        </div>}
        {busy && <p role="status" className="text-sm mb-4">Loading check…</p>}
        {assessment && (
          <div className="rise rounded-lg border bg-card">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-display text-2xl font-semibold capitalize">{assessment.mode} check</h2>
              <span className="font-mono text-xs text-muted-foreground">{assessment.questions.length} questions</span>
            </div>
            <ol className="divide-y">
              {assessment.questions.map((q, i) => {
                const fb = result?.feedback[i];
                return (
                  <li key={q.id} className="p-5 grid md:grid-cols-[1fr_260px] gap-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-accent-ink">Q{i + 1} · {q.concept}</p>
                      <div className="mt-1"><Markdown>{q.prompt}</Markdown></div>
                      <button aria-expanded={!!hints[q.id]} aria-controls={`hint-${q.id}`} onClick={() => setHints((h) => ({ ...h, [q.id]: !h[q.id] }))} className="mt-2 text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-accent-ink" data-testid={`button-hint-${q.id}`}>
                        <Lightbulb className="h-3.5 w-3.5" /> {hints[q.id] ? "Hide hint" : "Show hint"}
                      </button>
                      {hints[q.id] && <p id={`hint-${q.id}`} className="text-sm mt-2 rounded bg-secondary p-3">{q.hint}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground" htmlFor={`a-${q.id}`}>Answer ({q.unit || "unitless"})</label>
                      <div className="flex items-center mt-1 rounded-md border bg-background focus-within:border-accent">
                        <input id={`a-${q.id}`} type="number" step="any" inputMode="decimal" disabled={!!result || busy} value={answers[q.id] ?? ""}
                          onChange={(e) => changeAnswer(q.id, e.target.value)} data-testid={`input-answer-${q.id}`}
                          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 font-mono text-sm outline-none" />
                        <span className="px-3 font-mono text-xs text-muted-foreground">{q.unit}</span>
                      </div>
                      {fb && (
                        <div className={`mt-3 rounded-md p-3 text-sm ${fb.correct ? "bg-chart-3/10" : "bg-accent/10"}`} data-testid={`feedback-${q.id}`}>
                          <p className="font-medium flex items-center gap-1.5">{fb.correct ? <Check className="h-4 w-4 text-chart-3" /> : <X className="h-4 w-4 text-accent" />}{fb.correct ? "Correct" : `Expected ${fb.expected}`}</p>
                          <p className="text-muted-foreground mt-1">{fb.explanation}</p>
                          {!fb.correct && fb.lessonId && <button onClick={() => openLesson(fb.lessonId)} className="text-accent-ink underline mt-1" data-testid={`link-lesson-${q.id}`}>Open targeted lesson</button>}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="p-5 border-t">
              {!result ? (
                <button onClick={send} disabled={!allFilled || busy} className={btnPrimary} data-testid="button-submit">{busy ? "Checking..." : "Submit answers"}</button>
              ) : (
                <div className="rise grid md:grid-cols-[auto_1fr] gap-6 items-center">
                  <p className="font-display text-5xl font-extrabold" data-testid="text-score">{result.score}<span className="text-muted-foreground text-2xl">/{result.total}</span></p>
                  <div>
                    <p className="text-sm">{result.recommendation}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => begin("practice")} className={btnGhost} data-testid="button-practice">Practice</button>
                      <button onClick={() => begin("recheck")} className={btnAccent} data-testid="button-recheck">Recheck now</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section id="lesson" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-8">
        <nav aria-label="Lessons">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Lessons</p>
          {lessons.isLoading ? <div className="space-y-2"><Skel className="h-14" /><Skel className="h-14" /><Skel className="h-14" /></div>
            : lessons.isError ? <ErrorState onRetry={() => lessons.refetch()} />
              : (
                <ul className="space-y-1">
                  {courseLessons?.map((l) => (
                    <li key={l.id}>
                      <button onClick={() => setLessonId(l.id)} data-testid={`button-lesson-${l.id}`}
                        className={`w-full text-left rounded-md p-3 border-l-2 transition-colors ${current?.id === l.id ? "border-accent bg-card" : "border-transparent hover:bg-card"}`}>
                        <span className="block text-sm font-medium">{l.title}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {l.minutes} min · {l.concept}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </nav>
        <div className="min-w-0">
          {lessons.isLoading ? <Skel className="h-96" /> : !current ? (!lessons.isError && <Empty title="No lessons yet">Lessons will appear here once published.</Empty>) : (
            <article key={current.id} className="rise rounded-lg border bg-card p-6 md:p-8">
              <p className="font-mono text-xs text-accent-ink">{current.concept} · {current.minutes} min</p>
              <h2 className="font-display text-3xl font-extrabold mt-1 mb-6">{current.title}</h2>
              <Markdown>{current.content}</Markdown>
              {current.id === "circuits" && (<><p className="text-sm text-muted-foreground mt-8">Start with a single resistor, then split the voltage across two.</p><OhmLab /><DividerLab /></>)}
              <div className="mt-8 flex flex-wrap gap-2 border-t pt-5">
                <Link href={`/studio?course=${courseId}&topic=${encodeURIComponent(current.concept)}`} className={btnGhost} data-testid={`link-studio-${current.id}`}>Study {current.concept} in Studio <ArrowRight className="h-3.5 w-3.5 inline" /></Link>
                <button onClick={() => begin("recheck")} className={btnAccent} data-testid={`button-reassess-${current.id}`}>Reassess with a recheck</button>
              </div>
              <h3 className="font-display text-lg font-semibold mt-10 mb-3">Sources</h3>
              <Sources sources={current.sources} />
            </article>
          )}
        </div>
      </section>

      {courseId==="210" && <div id="signal-lab" className="mt-16 scroll-mt-24"><SignalExplorer /></div>}
      {courseId==="120" && <div className="mt-10"><LogicLab /></div>}
    </div>
  );
}
