import { useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, CalendarClock, X } from "lucide-react";
import { KEYS, readLS, type Session } from "@/lib/store";
import { useReviews } from "@/lib/use-reviews";
import { createReview, localDate } from "@/lib/reviews";
import { btn } from "@/components/shell";
import { trackReviewOutcome } from "@/lib/analytics";

const field = "mt-1 min-h-[44px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal focus:border-[var(--gold)] focus:outline-none";

export function ReviewNext({ session }: { session: Session }) {
  const { items, error: loadError, reload } = useReviews();
  const unclear = (session.reflection?.unclear ?? "").trim();
  const existing = items.find((i) => i.sessionId === session.id);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [topic, setTopic] = useState(unclear);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  if (!unclear) return null;

  if (existing) {
    return (
      <div className="flex min-h-[44px] flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--gold)]/60 bg-card px-4 py-3 text-sm" data-testid="review-next-existing">
        <CalendarClock className="h-4 w-4 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">Review item saved: <span className="font-medium">{existing.topic}</span>{existing.date ? ` · ${existing.date}` : " · no date"}</span>
        <Link href={`/review/${encodeURIComponent(existing.id)}`} className={btn.ghost + " min-h-[44px]"} data-testid="link-open-review">Open review <ArrowRight className="h-4 w-4" /></Link>
        <span className="sr-only" role="status">{status}</span>
      </div>
    );
  }

  if (dismissed) {
    return (
      <button type="button" onClick={() => setDismissed(false)} className="min-h-[44px] text-sm text-muted-foreground underline-offset-4 hover:underline" data-testid="button-undismiss-review">Show “Review this next” again</button>
    );
  }

  const save = async () => {
    const t = topic.trim();
    if (!t) { setError("Add a short topic before saving."); return; }
    setSaving(true); setError(null);
    const r = await createReview(session.id, t, date);
    setSaving(false);
    if (r.ok) {
      if (r.created) trackReviewOutcome("review_created");
      setStatus("Review item saved."); setOpen(false); reload();
    }
    else setError(r.error);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby={`rn-h-${session.id}`} data-testid="section-review-next">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Optional</p>
          <h3 id={`rn-h-${session.id}`} className="mt-1 font-display text-lg font-semibold">Review this next?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Suggested from what you saved as still unclear: <q className="text-foreground">{unclear}</q>. Nothing is saved unless you choose to.</p>
        </div>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss review suggestion" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary" data-testid="button-dismiss-review"><X className="h-4 w-4" /></button>
      </div>
      {loadError && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{loadError}</p>}
      {!open && error && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive" data-testid="text-review-next-unsaved"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {!open ? (
        <button type="button" onClick={() => {
          const records = readLS<Session[]>(KEYS.sessions, []);
          const value = Array.isArray(records) ? records.find((x) => x?.id === session.id)?.reflection?.unclear : undefined;
          const saved = typeof value === "string" ? value.trim() : "";
          if (!saved) { setError("This unclear note isn't saved yet. Save your reflection first, then try again."); return; }
          setError(null); setTopic(saved); setOpen(true);
        }} aria-expanded={false} className={btn.ghost + " mt-4 min-h-[44px]"} data-testid="button-open-review-next">
          <CalendarClock className="h-4 w-4" /> Review this next
        </button>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="block text-sm font-medium">Topic to explain later
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className={field} data-testid="input-review-topic" />
          </label>
          <label className="block text-sm font-medium">When would you like to revisit it? <span className="font-normal text-muted-foreground">(optional, you can move it anytime)</span>
            <input type="date" value={date} min={localDate()} onChange={(e) => setDate(e.target.value)} className={field + " sm:max-w-xs"} data-testid="input-review-date" />
          </label>
          {date && <button type="button" onClick={() => setDate("")} className="min-h-[44px] text-sm text-muted-foreground underline" data-testid="button-clear-review-date">No date</button>}
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="text-review-next-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Couldn't save: {error} Your text is still here; try again.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !topic.trim()} className={btn.gold + " min-h-[44px]"} data-testid="button-save-review-item">{saving ? "Saving…" : error ? "Retry save" : "Save review item"}</button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className={btn.ghost + " min-h-[44px]"} data-testid="button-cancel-review-item">Cancel</button>
          </div>
          <p className="text-xs text-muted-foreground">Saved on this device only.</p>
        </form>
      )}
      <span className="sr-only" role="status">{status}</span>
    </section>
  );
}
