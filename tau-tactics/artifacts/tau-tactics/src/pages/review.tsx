import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { AlertCircle, ArrowLeft, Check, Copy, Pencil, RotateCw, ShieldCheck, Trash2 } from "lucide-react";
import { useReviews } from "@/lib/use-reviews";
import { buildReviewPrompt, deleteReview, localDate, updateReview, type ReviewItem } from "@/lib/reviews";
import { copyText, KEYS, useLocal, type Session } from "@/lib/store";
import { btn, DeviceNote, PageHeader } from "@/components/shell";
import { cn } from "@/lib/utils";
import { readReviewDraft, writeReviewDraft } from "@/lib/review-drafts";
import { trackReviewOutcome } from "@/lib/analytics";

const CANT = "I cannot explain it yet.";
const field = "mt-1 min-h-[44px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal focus:border-[var(--gold)] focus:outline-none";
const tall = " min-h-[44px]";

function Alert({ children, onRetry, testId }: { children: ReactNode; onRetry?: () => void; testId: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid={testId}>
      <AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{children}</span>
      {onRetry && <button type="button" onClick={onRetry} className={btn.ghost + tall} data-testid={`${testId}-retry`}><RotateCw className="h-4 w-4" /> Retry</button>}
    </div>
  );
}

function Card({ id, step, title, children }: { id: string; step?: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rise rounded-2xl border border-border bg-card p-5 sm:p-6">
      {step && <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{step}</p>}
      <h2 id={id} className="mt-1 font-display text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function Review() {
  const params = useParams<{ id: string }>();
  const id = (() => { try { return decodeURIComponent(params.id ?? ""); } catch { return params.id ?? ""; } })();
  const { items, error, reload } = useReviews();
  const item = items.find((i) => i.id === id);
  if (!item) {
    return (
      <div>
        <PageHeader kicker="Review" title={"This review isn't here"} />
        {error && <div className="mb-4"><Alert onRetry={reload} testId="alert-review-load">{error}</Alert></div>}
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground" data-testid="empty-review-missing">
          It may have been deleted, or saved in a different browser. Review items live on the device where you saved them.
          <div className="mt-4"><Link href="/" className={btn.ghost + tall} data-testid="link-back-today"><ArrowLeft className="h-4 w-4" /> Back to Today</Link></div>
        </div>
        <OrphanedDraft key={id} id={id} />
      </div>
    );
  }
  return <ReviewBody key={item.id} item={item} />;
}

function OrphanedDraft({ id }: { id: string }) {
  const [draft, setDraft] = useState(() => readReviewDraft(id));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discardError, setDiscardError] = useState(false);
  const [status, setStatus] = useState("");
  if (!draft) return null;

  const text = [
    `Topic: ${draft.topic}`,
    `Planned date: ${draft.date || "No date"}`,
    `Explanation:\n${draft.attempt}`,
    `Prompt:\n${draft.prompt}`,
    `Next step: ${draft.next === "revisit" ? "Revisit later" : draft.next === "example" ? "Try another example" : draft.next === "pause" ? "Pause this topic" : "Not selected"}`,
    `Revisit date: ${draft.nextDate || "No date"}`,
  ].join("\n\n");
  const copy = async () => {
    let ok = false;
    try { ok = await copyText(text); } catch { /* Keep the selectable copy available. */ }
    setStatus(ok ? "Draft copied." : "Couldn't copy automatically. Select the draft text and copy it manually.");
  };
  const discard = () => {
    if (!writeReviewDraft(id, null)) {
      setDiscardError(true);
      return;
    }
    setDraft(null);
  };

  return (
    <div className="mt-6 max-w-3xl">
      <Card id="orphaned-draft-h" title="Your unsaved draft is still here">
        <p className="text-sm text-muted-foreground">This review is unavailable, but this tab has a recovery copy of your draft. You can copy it or discard it. This read-only copy does not restore the review or change your session history. Copy anything you want to keep before closing this tab.</p>
        <label className="block text-sm font-medium">Recovery copy
          <textarea readOnly value={text} rows={12} className={field + " resize-y"} data-testid="text-orphaned-draft" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={btn.gold + tall} data-testid="button-copy-orphaned-draft"><Copy className="h-4 w-4" /> Copy draft</button>
          <button type="button" onClick={() => setConfirmDiscard(true)} className={btn.ghost + tall} data-testid="button-discard-orphaned-draft"><Trash2 className="h-4 w-4" /> Discard draft</button>
        </div>
        <p role="status" className="text-sm">{status}</p>
        {confirmDiscard && (
          <div role="alertdialog" aria-labelledby="discard-draft-h" className="rounded-xl border border-destructive/50 p-4">
            <p id="discard-draft-h" className="text-sm">Discard this tab's recovery copy? This cannot be undone. Your session history will not change.</p>
            {discardError && <Alert testId="alert-discard-draft">Couldn't discard the stored draft. Your copy is still here. Try again when browser storage is available.</Alert>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={discard} className={btn.ghost + tall} data-testid="button-confirm-discard-draft">Discard recovery copy</button>
              <button type="button" onClick={() => setConfirmDiscard(false)} className={btn.ghost + tall} data-testid="button-keep-draft">Keep draft</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ReviewBody({ item }: { item: ReviewItem }) {
  const [, navigate] = useLocation();
  const [sessions] = useLocal<Session[]>(KEYS.sessions, []);
  const source = sessions.find((s) => s.id === item.sessionId);
  const today = localDate();
  const [recovered] = useState(() => readReviewDraft(item.id));
  const expectedRevision = useRef(recovered?.revision ?? item.revision);
  const [draftError, setDraftError] = useState(false);

  // edit / reschedule
  const [editing, setEditing] = useState(recovered?.editing ?? false);
  const [topic, setTopic] = useState(recovered?.topic ?? item.topic);
  const [date, setDate] = useState(recovered?.date ?? item.date);
  const [editErr, setEditErr] = useState<string | null>(null);
  // delete
  const [confirmDel, setConfirmDel] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  // attempt
  const [attempt, setAttempt] = useState(recovered?.attempt ?? (item.feedbackUnlocked ? "" : item.attempt));
  const [attErr, setAttErr] = useState<string | null>(null);
  const [pendingAttempt, setPendingAttempt] = useState<string | null>(null);
  const [confirmRetry, setConfirmRetry] = useState(false);
  // prompt
  const savedPrompt = item.promptDraft ?? buildReviewPrompt(item);
  const [prompt, setPrompt] = useState(recovered?.prompt ?? savedPrompt);
  const [promptErr, setPromptErr] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  // next action
  const [next, setNext] = useState<ReviewItem["nextAction"]>(recovered?.next ?? item.nextAction);
  const [nextDate, setNextDate] = useState(recovered?.nextDate ?? item.date);
  const [nextErr, setNextErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  // keep prompt in sync with stored value when not edited locally
  const promptBase = useRef(savedPrompt);
  useEffect(() => {
    if (prompt === promptBase.current) setPrompt(savedPrompt);
    promptBase.current = savedPrompt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPrompt]);

  const dirtyEdit = editing && (topic.trim() !== item.topic || date !== item.date);
  const dirtyAttempt = !item.feedbackUnlocked && attempt.trim() !== (item.attempt ?? "").trim();
  const dirtyPrompt = item.feedbackUnlocked && prompt !== savedPrompt;
  const dirtyNext = !!next && (next !== item.nextAction || (next === "revisit" && nextDate !== item.date));
  const dirty = dirtyEdit || dirtyAttempt || dirtyPrompt || dirtyNext;

  useEffect(() => {
    const ok = writeReviewDraft(item.id, dirty ? {
      revision: expectedRevision.current, editing, topic, date, attempt, prompt, next, nextDate,
    } : null);
    setDraftError(!ok && dirty);
  }, [item.id, item.revision, dirty, editing, topic, date, attempt, prompt, next, nextDate]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const run = async (patch: Partial<ReviewItem>, setErr: (e: string | null) => void, ok: string) => {
    setBusy(true); setErr(null);
    const r = await updateReview({ ...item, revision: expectedRevision.current }, patch);
    setBusy(false);
    if (r.ok) { expectedRevision.current = r.item!.revision; setStatus(ok); return true; }
    setErr(`Couldn't save: ${r.error} Your text is still here.`);
    return false;
  };

  const saveEdit = async () => {
    if (!topic.trim()) { setEditErr("Topic can't be blank."); return; }
    const changedTopic = topic.trim() !== item.topic;
    if (await run({ topic: topic.trim(), date }, setEditErr, "Topic and date saved.")) {
      setEditing(false); setNextDate(date);
      if (changedTopic) { setAttempt(""); setNext(undefined); setPrompt(buildReviewPrompt({ topic: topic.trim(), attempt: "" })); }
    }
  };
  const saveAttempt = async (text: string) => {
    setPendingAttempt(text);
    if (await run({ attempt: text, feedbackUnlocked: true }, setAttErr, "Attempt saved. Check steps are now open.")) {
      trackReviewOutcome("review_attempt_saved");
      setAttempt(""); setPendingAttempt(null);
    }
  };
  const newAttempt = async () => {
    if (await run({ attempt: "", feedbackUnlocked: false, promptDraft: undefined }, setAttErr, "Ready for another attempt. Notes closed.")) {
      setConfirmRetry(false); setAttempt(""); setPrompt(buildReviewPrompt({ ...item, attempt: "" })); setCopyState("idle");
    }
  };
  const savePrompt = () => run({ promptDraft: prompt }, setPromptErr, "Prompt edits saved.");
  const saveNext = async () => {
    if (!next) return;
    const patch: Partial<ReviewItem> = { nextAction: next, reviewedAt: Date.now() };
    if (next === "revisit") patch.date = nextDate;
    if (await run(patch, setNextErr, "Next step saved.")) {
      trackReviewOutcome("review_next_action_saved", next);
    }
  };
  const doDelete = async () => {
    setBusy(true); setDelErr(null);
    const r = await deleteReview(item);
    setBusy(false);
    if (r.ok) { writeReviewDraft(item.id, null); navigate("/"); } else setDelErr(`Couldn't delete: ${r.error}`);
  };
  const doCopy = async () => {
    let ok = false;
    try { ok = await copyText(prompt); } catch { /* Manual-copy fallback below. */ }
    setCopyState(ok ? "ok" : "fail");
    setStatus(ok ? "Prompt copied." : "Copy failed. Select the prompt text and copy it manually.");
  };
  const leave = (to: string) => (e: MouseEvent) => { if (dirty) { e.preventDefault(); setLeaveTo(to); } };

  const ack = item.reviewedAt
    ? item.nextAction === "pause" ? "You checked where you stand and chose to pause. That's a real decision."
      : item.nextAction === "example" ? "You returned to this topic and chose a fresh example next."
      : "You returned to this topic and chose to revisit it. Your next step is yours to change."
    : null;

  return (
    <div className="max-w-3xl">
      <Link href="/" onClick={leave("/")} className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> Today
      </Link>
      {leaveTo && (
        <div role="alertdialog" aria-labelledby="leave-h" className="mb-6 rounded-2xl border border-[var(--gold)] bg-card p-4">
          <p id="leave-h" className="text-sm font-medium">You have unsaved text on this page. Leave without saving it?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setLeaveTo(null)} className={btn.gold + tall} data-testid="button-stay">Stay and save</button>
            <button type="button" onClick={() => { writeReviewDraft(item.id, null); navigate(leaveTo); }} className={btn.ghost + tall} data-testid="button-leave">Leave and discard</button>
          </div>
        </div>
      )}

      <PageHeader kicker={`Review${item.date ? ` · planned ${item.date}` : " · no date"}`} title={<span data-testid="text-review-topic">{item.topic}</span>}>
        <span data-testid="text-review-source">
          {source ? <>From your reflection on <span className="text-foreground">{source.task}</span>{source.subject ? ` (${source.subject})` : ""}, {format(source.completedAt, "MMM d")}.</>
            : "From an earlier session that is no longer in your history."}
          {" "}This review item stays even if that session is deleted.
        </span>
      </PageHeader>

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Review is optional. Passing a planned date changes nothing; you can move or remove it.</p>
        {dirty && <p role="status" className="text-sm text-muted-foreground">{draftError ? "Draft could not be stored for reload. Keep a copy before closing this tab." : "Unsaved draft kept in this tab for your return. Use the save buttons to update your review."}</p>}
        {expectedRevision.current !== item.revision && <Alert testId="alert-review-conflict">This item changed since your edits began. Copy any draft text you want to keep, then <button className="min-h-[44px] underline" onClick={() => { writeReviewDraft(item.id, null); window.location.reload(); }} data-testid="button-reload-review">discard drafts and reload the saved review</button>.</Alert>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setTopic(item.topic); setDate(item.date); setEditing(!editing); setEditErr(null); }} aria-expanded={editing} className={btn.ghost + tall} data-testid="button-edit-review"><Pencil className="h-4 w-4" /> Edit or reschedule</button>
          <button type="button" onClick={() => setConfirmDel(true)} className={btn.ghost + tall} data-testid="button-delete-review"><Trash2 className="h-4 w-4" /> Delete review item</button>
        </div>

        {confirmDel && (
          <div role="alertdialog" aria-labelledby="del-h" className="rounded-2xl border border-destructive/50 bg-card p-4">
            <p id="del-h" className="text-sm font-medium">Delete this review item and its saved attempt? Your original session and reflection stay.</p>
            {delErr && <div className="mt-3"><Alert onRetry={doDelete} testId="alert-delete">{delErr}</Alert></div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={doDelete} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-destructive px-5 text-sm font-medium text-destructive-foreground disabled:opacity-40" data-testid="button-confirm-delete">Delete review item</button>
              <button type="button" onClick={() => setConfirmDel(false)} className={btn.ghost + tall} data-testid="button-cancel-delete">Keep it</button>
            </div>
          </div>
        )}

        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); void saveEdit(); }} className="space-y-3 rounded-2xl border border-[var(--gold)]/50 bg-card p-5" aria-label="Edit review item">
            <label className="block text-sm font-medium">Topic<input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className={field} data-testid="input-edit-topic" /></label>
            <label className="block text-sm font-medium">Planned date <span className="font-normal text-muted-foreground">(optional)</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field + " sm:max-w-xs"} data-testid="input-edit-date" /></label>
            {date && <button type="button" onClick={() => setDate("")} className="min-h-[44px] text-sm text-muted-foreground underline" data-testid="button-clear-date">Remove date</button>}
            {topic.trim() !== item.topic && (item.attempt || item.feedbackUnlocked || item.promptDraft || item.nextAction) && (
              <p role="alert" className="rounded-lg border border-[var(--gold)] bg-[var(--gold)]/10 px-3 py-2 text-sm" data-testid="text-topic-warning">Changing the topic clears this item's saved attempt, prompt edits, and next step, so you start fresh on the new topic. Changing only the date keeps them.</p>
            )}
            {editErr && <Alert onRetry={saveEdit} testId="alert-edit">{editErr}</Alert>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy || !topic.trim()} className={btn.gold + tall} data-testid="button-save-edit">Save changes</button>
              <button type="button" onClick={() => setEditing(false)} className={btn.ghost + tall} data-testid="button-cancel-edit">{dirtyEdit ? "Discard changes" : "Close"}</button>
            </div>
          </form>
        )}

        {!item.feedbackUnlocked ? (
          <Card id="attempt-h" step="Step 1 · notes closed" title="Explain it without looking">
            <p className="text-sm text-muted-foreground">Close your notes and write what you can recall in your own words. A rough, partial answer is useful. Checking comes after.</p>
            <label className="block text-sm font-medium">Your explanation
              <textarea value={attempt} maxLength={4000} onChange={(e) => { setAttempt(e.target.value); setPendingAttempt(null); }} rows={6} className={field + " resize-y"} data-testid="input-attempt" />
            </label>
            {attErr && <Alert onRetry={() => saveAttempt(pendingAttempt ?? attempt.trim())} testId="alert-attempt">{attErr}</Alert>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy || !attempt.trim()} onClick={() => saveAttempt(attempt.trim())} className={btn.gold + tall} data-testid="button-save-attempt"><Check className="h-4 w-4" /> Save attempt and check it</button>
              <button type="button" disabled={busy} onClick={() => saveAttempt(CANT)} className={btn.ghost + tall} data-testid="button-cant-explain">I cannot explain it yet</button>
            </div>
            <p className="text-xs text-muted-foreground">Your saved review changes only when you choose a save button.</p>
          </Card>
        ) : (
          <>
            <Card id="saved-h" step="Step 1 · saved" title="What you wrote from memory">
              <blockquote className="whitespace-pre-wrap rounded-lg border-l-2 border-[var(--gold)] bg-background px-4 py-3 text-sm" data-testid="text-saved-attempt">{item.attempt || CANT}</blockquote>
              {item.attempt === CANT && <p className="text-sm text-muted-foreground">Naming that is a starting point. Use the steps below, then try again.</p>}
            </Card>

            <Card id="check-h" step="Step 2" title="Check it against your course material">
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                <li>Open your notes, textbook, or lecture slides for this topic.</li>
                <li>Compare definitions and each step with what you wrote. Mark what matches.</li>
                <li>Find the <em>first</em> place they differ and correct just that.</li>
                <li>Close the notes again and apply the idea to a new example you haven't seen worked.</li>
              </ol>
              <details className="rounded-xl border border-border bg-background p-4">
                <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-medium" data-testid="toggle-ai-prompt">Optional: ask an AI tool for feedback on your attempt</summary>
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">This prompt is built here from your topic and attempt only. You can edit it. Nothing is sent anywhere; copying is up to you.</p>
                  <label className="block text-sm font-medium">Prompt preview
                    <textarea value={prompt} maxLength={12000} onChange={(e) => { setPrompt(e.target.value); setCopyState("idle"); }} rows={9} className={field + " resize-y font-mono text-xs"} data-testid="input-prompt" />
                  </label>
                  <div className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground" data-testid="text-privacy">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Before you paste: remove names and personal details, don't include other students' work, exams, or course files you aren't allowed to share, and check your course's AI policy. Treat any answer as a lead to verify against your course material.</span>
                  </div>
                  {promptErr && <Alert onRetry={savePrompt} testId="alert-prompt">{promptErr}</Alert>}
                  {copyState === "fail" && <Alert testId="alert-copy">Couldn't copy automatically. Select the prompt text above and copy it manually.</Alert>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={doCopy} className={btn.ghost + tall} data-testid="button-copy-prompt">{copyState === "ok" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copyState === "ok" ? "Copied" : "Copy prompt"}</button>
                    <button type="button" disabled={busy || !dirtyPrompt} onClick={savePrompt} className={btn.ghost + tall} data-testid="button-save-prompt">Save prompt edits</button>
                    {dirtyPrompt && <button type="button" onClick={() => setPrompt(savedPrompt)} className="min-h-[44px] px-3 text-sm text-muted-foreground underline" data-testid="button-reset-prompt">Discard edits</button>}
                  </div>
                </div>
              </details>
            </Card>

            <Card id="next-h" step="Step 3" title="What will you do next?">
              <p className="text-sm text-muted-foreground">This is your self-reported next step, not a measure of mastery. No points are awarded.</p>
              <fieldset>
                <legend className="sr-only">Next action</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([["revisit", "Revisit later"], ["example", "Try another example"], ["pause", "Pause this topic"]] as const).map(([v, l]) => (
                    <label key={v} className={cn("flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm", next === v ? "border-[var(--gold)] bg-[var(--gold)]/10 font-medium" : "border-border bg-background")}>
                      <input type="radio" name="next" value={v} checked={next === v} onChange={() => setNext(v)} className="h-4 w-4 accent-[#d4af37]" data-testid={`radio-next-${v}`} />{l}
                    </label>
                  ))}
                </div>
              </fieldset>
              {next === "revisit" && (
                <label className="block text-sm font-medium">Revisit on <span className="font-normal text-muted-foreground">(optional, movable)</span>
                  <input type="date" value={nextDate} min={today} onChange={(e) => setNextDate(e.target.value)} className={field + " sm:max-w-xs"} data-testid="input-next-date" /></label>
              )}
              {nextErr && <Alert onRetry={saveNext} testId="alert-next">{nextErr}</Alert>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || !next} onClick={saveNext} className={btn.gold + tall} data-testid="button-save-next">Save next step</button>
                <button type="button" onClick={() => setConfirmRetry(true)} className={btn.ghost + tall} data-testid="button-new-attempt"><RotateCw className="h-4 w-4" /> Try explaining again</button>
              </div>
              {confirmRetry && (
                <div role="alertdialog" aria-labelledby="retry-h" className="rounded-xl border border-[var(--gold)]/60 bg-background p-4">
                  <p id="retry-h" className="text-sm">Start a fresh attempt? This clears the saved attempt and any saved prompt edits for this item. Topic, date, and next step stay.</p>
                  {attErr && <Alert onRetry={newAttempt} testId="alert-new-attempt">{attErr}</Alert>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={newAttempt} className={btn.gold + tall} data-testid="button-confirm-new-attempt">Start fresh attempt</button>
                    <button type="button" onClick={() => setConfirmRetry(false)} className={btn.ghost + tall} data-testid="button-cancel-new-attempt">Keep my saved work</button>
                  </div>
                </div>
              )}
              {ack && (
                <p className="rounded-xl border border-dashed border-[var(--gold)]/60 px-4 py-3 text-sm" data-testid="text-leo-ack">
                  <span className="font-display font-semibold">Leo:</span> {ack}
                  {item.reviewedAt && <span className="mt-1 block font-mono text-[11px] text-muted-foreground">Last reviewed {format(item.reviewedAt, "MMM d, h:mm a")}</span>}
                </p>
              )}
            </Card>
          </>
        )}
        <DeviceNote>Saved on this device only, when you press a save button.</DeviceNote>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
