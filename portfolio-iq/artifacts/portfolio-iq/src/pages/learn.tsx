import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Clock, Hand, Bookmark, BookmarkCheck, ExternalLink, MessageCircle } from "lucide-react";
import { useGetLearningTopics, useUpdateLearningProgress, getGetLearningTopicsQueryKey, type LearningTopic } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/kit";
import { errMsg } from "@/lib/money";
import { cn } from "@/lib/utils";
import { askAbout } from "@/lib/ask";
import { Link } from "wouter";
import { usePrefs } from "@/hooks/use-personalization";
import { learnStyle, rankLessons, shapeContent, type LearnStyle } from "@/lib/personalize";

export function useToggleBookmark() {
  const qc = useQueryClient();
  const upd = useUpdateLearningProgress();
  return (t: LearningTopic) => upd.mutate({ id: t.id, data: { bookmarked: !t.bookmarked } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetLearningTopicsQueryKey() }) });
}

/** Qualitative visual: each paragraph's opening idea as a connected step. No numbers or scales are implied. */
function KeyPoints({ paras }: { paras: string[] }) {
  const points = paras.map((p) => (p.split(/(?<=[.!?])\s/)[0] ?? p).trim()).filter(Boolean).slice(0, 5);
  if (!points.length) return null;
  return (
    <figure className="rounded-xl bg-secondary/60 p-4" data-testid="figure-key-points">
      <figcaption className="eyebrow mb-3 !text-muted-foreground">Key points at a glance</figcaption>
      <ol className="relative space-y-3 border-l-2 border-accent/40 pl-5">
        {points.map((pt, i) => (
          <li key={i} className="relative text-sm"><span aria-hidden className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-accent bg-background" />{pt}</li>
        ))}
      </ol>
    </figure>
  );
}

function Lesson({ topic, onClose, style }: { topic: LearningTopic | null; onClose: () => void; style: LearnStyle }) {
  const qc = useQueryClient();
  const upd = useUpdateLearningProgress();
  const toggle = useToggleBookmark();
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const shaped = topic ? shapeContent(topic.content, style) : { lead: [], more: [] };
  const check = () => {
    if (!topic || choice == null) return;
    upd.mutate({ id: topic.id, data: { answer: choice } }, {
      onSuccess: () => { setFeedback({ ok: true, msg: "Correct. Lesson marked complete." }); qc.invalidateQueries({ queryKey: getGetLearningTopicsQueryKey() }); },
      onError: (e) => setFeedback({ ok: false, msg: errMsg(e) || "Not quite. Reread the lesson and try again." }),
    });
  };
  const quiz = topic && (
            <section className="paper p-5" aria-labelledby="quiz-q">
      <p className="eyebrow mb-2">Check yourself</p>
      <p id="quiz-q" className="font-medium">{topic.question}</p>
      <div className="mt-3 space-y-2" role="radiogroup">
        {topic.options.map((o, i) => (
          <button key={i} role="radio" aria-checked={choice === i} onClick={() => { setChoice(i); setFeedback(null); }} data-testid={`button-option-${i}`}
            className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors", choice === i ? "border-primary bg-primary/5" : "hover:border-foreground/30")}>
            <span className={cn("num grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs", choice === i && "border-primary bg-primary text-primary-foreground")}>{String.fromCharCode(65 + i)}</span>{o}
          </button>
        ))}
      </div>
      {feedback && <p role="status" className={cn("mt-3 text-sm", feedback.ok ? "text-chart-2" : "text-destructive")} data-testid="text-quiz-feedback">{feedback.msg}</p>}
      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={() => toggle(topic)} data-testid="button-bookmark-lesson">{topic.bookmarked ? <BookmarkCheck className="mr-2 h-4 w-4 text-accent" /> : <Bookmark className="mr-2 h-4 w-4" />}{topic.bookmarked ? "Saved" : "Save for later"}</Button>
        <Button onClick={check} disabled={choice == null || upd.isPending} data-testid="button-check-answer">{upd.isPending ? "Checking..." : "Check answer"}</Button>
      </div>
    </section>
  );
  return (
    <Dialog open={!!topic} onOpenChange={(o) => { if (!o) { onClose(); setChoice(null); setFeedback(null); } }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-background sm:max-w-2xl">
        {topic && (
          <>
            <DialogHeader>
              <p className="eyebrow">{topic.track} · {topic.level} · {topic.minutes} min</p>
              <DialogTitle className="font-display text-4xl font-normal leading-tight">{topic.title}</DialogTitle>
              <DialogDescription>{topic.description}</DialogDescription>
            </DialogHeader>
            {style.quizFirst && <><p className="text-xs text-muted-foreground" data-testid="text-quiz-first">Question first, as you asked. The full lesson follows below.</p>{quiz}</>}
            {style.visual && <KeyPoints paras={shaped.lead.concat(shaped.more)} />}
            <div className="space-y-3 text-[15px] leading-relaxed" data-testid="text-lesson-content">
              {shaped.lead.map((para, i) => <p key={i} className="whitespace-pre-wrap">{para}</p>)}
              {shaped.more.length > 0 && (
                <details className="rounded-lg border bg-card/60 p-3" data-testid="details-lesson-more">
                  <summary className="cursor-pointer text-sm font-medium text-accent">Read the rest ({shaped.more.length} more {shaped.more.length === 1 ? "paragraph" : "paragraphs"})</summary>
                  <div className="mt-3 space-y-3">{shaped.more.map((para, i) => <p key={i} className="whitespace-pre-wrap">{para}</p>)}</div>
                </details>
              )}
            </div>
            {style.interactive && (
              <div className="rounded-lg border border-dashed border-chart-2/60 bg-chart-2/5 p-4 text-sm" data-testid="panel-try-it">
                <p className="flex items-center gap-2 font-medium"><Hand className="h-4 w-4 text-chart-2" />Try it</p>
                <p className="mt-1 text-muted-foreground">Pick one holding you own or have heard of. In two sentences, explain how "{topic.title}" applies to it, then check your reasoning with the assistant.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { const text = `I'm practicing "${topic.title}". Here is my own example: [describe a holding and how the idea applies]. Is my reasoning sound? Point out one thing I missed.`; onClose(); requestAnimationFrame(() => askAbout(text)); }} data-testid="button-try-it">Draft my example in the assistant</Button>
              </div>
            )}
            {topic.risk && <p className="rounded-lg border-l-[3px] border-accent bg-accent/5 p-3 text-sm"><span className="font-medium">The risk: </span>{topic.risk}</p>}
            {topic.sources.length > 0 && (
              <div className="text-sm"><p className="eyebrow mb-1 !text-muted-foreground">Sources · {topic.evidence}</p>
                {topic.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 py-0.5 text-accent hover:underline">{s.title} <span className="text-muted-foreground">({s.publisher})</span><ExternalLink className="h-3 w-3" /></a>)}
              </div>
            )}
            <Button variant="outline" onClick={() => {
              const question = `Help me understand "${topic.title}". Explain it in plain language with an example and one important limitation.`;
              onClose();
              requestAnimationFrame(() => askAbout(question));
            }} data-testid="button-ask-lesson"><MessageCircle className="mr-2 h-4 w-4" />Ask about this lesson</Button>
            {!style.quizFirst && quiz}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Learn() {
  const q = useGetLearningTopics();
  const [openId, setOpenId] = useState<string | null>(null);
  const topics = useMemo(() => q.data ?? [], [q.data]);
  const tracks = useMemo(() => Array.from(new Set(topics.map((t) => t.track))), [topics]);
  const { prefs } = usePrefs();
  const style = learnStyle(prefs);
  const ranked = useMemo(() => [...rankLessons(topics, prefs)].sort((a, b) => b.score - a.score), [topics, prefs]);
  const reasons = useMemo(() => new Map(ranked.map((r) => [r.lesson.id, r.reason])), [ranked]);
  const picks = ranked.filter((r) => !r.lesson.completed && (prefs ? r.score > 0 : true)).slice(0, 3);
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const done = topics.filter((t) => t.completed).length;
  const open = topics.find((t) => t.id === openId) ?? null;
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Small lessons, one question each." lede="Read for a few minutes, answer one question, and the lesson is yours. Progress saves to this workspace." />
      {topics.length === 0 ? <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No lessons available" body="Check back soon." /> : (
        <>
          <div className="paper rise mb-8 flex items-center gap-5 p-5">
            <p className="num text-3xl" data-testid="text-progress">{done}<span className="text-muted-foreground">/{topics.length}</span></p>
            <div className="flex-1"><p className="mb-2 text-sm text-muted-foreground">{done === topics.length ? "Every lesson complete. Revisit any time." : "lessons complete"}</p><Progress value={(done / topics.length) * 100} className="h-2 bg-secondary [&>div]:bg-accent" /></div>
          </div>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="text-learn-style">
            <span>Lessons shown as: <span className="font-medium text-foreground">{style.label}</span></span>
            <Link href={prefs?.status === "new" ? "/onboarding" : "/settings"} className="underline underline-offset-4" data-testid="link-learn-preferences">{prefs?.status === "new" ? "Personalize" : "Change how lessons read"}</Link>
          </div>
          {picks.length > 0 && (
            <section className="mb-10" aria-labelledby="picks-h" data-testid="section-recommended-lessons">
              <h2 id="picks-h" className="mb-4 font-display text-3xl">{prefs && picks.some((r) => r.reason) ? "Start here" : "Up next"}</h2>
              <ol className="grid gap-3 md:grid-cols-3">
                {picks.map((r) => (
                  <li key={r.lesson.id}>
                    <button onClick={() => setOpenId(r.lesson.id)} className="paper flex h-full w-full flex-col p-4 text-left transition-transform hover:-translate-y-0.5" data-testid={`card-recommended-${r.lesson.id}`}>
                      <span className="font-medium">{r.lesson.title}</span>
                      <span className="mt-1 flex-1 text-xs text-muted-foreground">{r.lesson.minutes} min · {r.lesson.track}</span>
                      {r.reason && <span className="mt-2 text-xs text-accent" data-testid={`text-reason-${r.lesson.id}`}>{r.reason}</span>}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {tracks.map((track) => (
            <section key={track} className="mb-10">
              <h2 className="mb-4 font-display text-3xl">{track}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {ranked.map((r) => r.lesson).filter((t) => t.track === track).map((t) => (
                  <button key={t.id} onClick={() => setOpenId(t.id)} className="paper group flex items-start gap-4 p-5 text-left transition-transform hover:-translate-y-0.5" data-testid={`card-lesson-${t.id}`}>
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border", t.completed ? "border-chart-2 bg-chart-2 text-white" : "text-muted-foreground")}>{t.completed ? <Check className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}</span>
                    <span className="flex-1">
                      <span className="block font-medium">{t.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{t.description}</span>
                      <span className="mt-2 flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.minutes} min</span><span>{t.level}</span>{!t.completed && reasons.get(t.id) && <span className="text-accent">{reasons.get(t.id)}</span>}{t.bookmarked && <BookmarkCheck className="h-3.5 w-3.5 text-accent" />}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
      <Lesson topic={open} onClose={() => setOpenId(null)} style={style} />
    </div>
  );
}
