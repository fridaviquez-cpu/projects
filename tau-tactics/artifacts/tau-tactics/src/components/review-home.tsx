import { Link } from "wouter";
import { AlertCircle, ArrowRight, CalendarClock, ChevronDown, HardDrive, RotateCw } from "lucide-react";
import { useReviews } from "@/lib/use-reviews";
import { localDate, type ReviewItem } from "@/lib/reviews";
import { btn } from "@/components/shell";

function Row({ item }: { item: ReviewItem }) {
  return (
    <li>
      <Link href={`/review/${encodeURIComponent(item.id)}`} className="lift flex min-h-[44px] items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 hover:border-[var(--gold)]" data-testid={`link-review-${item.id}`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.topic}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{item.date ? `Planned ${item.date}` : "No date"}{item.reviewedAt ? " · reviewed before" : ""}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export function ReviewHome() {
  const { items, error, reload } = useReviews();
  const today = localDate();
  const ready = items.filter((i) => !i.date || i.date <= today).sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
  const later = items.filter((i) => i.date && i.date > today).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="review-home-h" data-testid="section-review-home">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Your own questions</p>
      <h2 id="review-home-h" className="mt-1 font-display text-2xl font-semibold">Ready to review</h2>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">Topics you chose from reflections. Explain one from memory, then check it. Dates are only suggestions; move or clear them anytime.</p>
      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="text-review-home-error">
          <AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
          <button type="button" onClick={reload} className={btn.ghost + " min-h-[44px]"} data-testid="button-retry-reviews"><RotateCw className="h-4 w-4" /> Try again</button>
        </div>
      )}
      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground" data-testid="empty-reviews">
          <CalendarClock className="mb-2 h-5 w-5 text-gold" aria-hidden />
          Nothing saved yet. After a focus block, note what still feels unclear and choose “Review this next” if you want to come back to it.
        </div>
      ) : (
        <>
          {ready.length ? <ul className="mt-4 space-y-2">{ready.map((i) => <Row key={i.id} item={i} />)}</ul>
            : <p className="mt-4 text-sm text-muted-foreground">Nothing planned for today. Your later items are below.</p>}
          {later.length > 0 && (
            <details className="group mt-4">
              <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium" data-testid="toggle-later-reviews"><ChevronDown aria-hidden className="h-4 w-4 group-open:rotate-180" /> Planned later ({later.length})</summary>
              <ul className="mt-2 space-y-2">{later.map((i) => <Row key={i.id} item={i} />)}</ul>
            </details>
          )}
        </>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><HardDrive className="h-3.5 w-3.5" />Saved in this browser on this device only. No reminders, no points.</p>
    </section>
  );
}
