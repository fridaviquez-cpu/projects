import { format } from "date-fns";
import { Check, NotebookPen, Trash2 } from "lucide-react";
import type { Session } from "@/lib/store";
import { focusHistory } from "@/lib/session-cycle";
import { DeviceNote } from "@/components/shell";
import { cn } from "@/lib/utils";

type Props = { sessions: Session[]; activeId: string | null; onOpen: (id: string) => void; onDelete: (id: string) => void; onClear: () => void };

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export function SessionHistory({ sessions, activeId, onOpen, onDelete, onClear }: Props) {
  const h = focusHistory(sessions);
  const unlabeled = sessions.filter((s) => !s.subject?.trim()).length;
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="hist-h" data-testid="section-history">
      <div className="flex items-center justify-between">
        <h2 id="hist-h" className="font-display text-xl font-semibold">History</h2>
        {sessions.length > 0 && <button type="button" onClick={onClear} className="min-h-11 px-2 text-xs text-muted-foreground hover:text-destructive" data-testid="button-clear-log">Clear all</button>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary p-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">This week</dt>
          <dd className="font-display text-2xl font-semibold" data-testid="text-week-sessions">{h.weekSessions}<span className="ml-1 text-sm font-normal text-muted-foreground">{h.weekSessions === 1 ? "session" : "sessions"}</span></dd>
          <dd className="font-mono text-[11px] text-muted-foreground">since Mon {format(h.weekStart, "MMM d")}</dd>
        </div>
        <div className="rounded-xl bg-secondary p-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">All time focused</dt>
          <dd className="font-display text-2xl font-semibold" data-testid="text-total-minutes">{fmtMin(h.totalMinutes)}</dd>
          <dd className="font-mono text-[11px] text-muted-foreground">{h.totalMinutes} minutes</dd>
        </div>
      </dl>
      <div className="mt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Most common subjects · all time</p>
        {h.subjects.length ? (
          <ol className="mt-1.5 flex flex-wrap gap-1.5" data-testid="list-subjects">
            {h.subjects.map((s) => <li key={s.subject} className="rounded-full border border-[var(--gold)]/50 px-2.5 py-1 text-xs">{s.subject} <span className="font-mono text-muted-foreground">×{s.count}</span></li>)}
          </ol>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground" data-testid="text-subjects-empty">
            {sessions.length ? "None of your logged blocks have a subject yet. Older entries were saved before subjects existed. Add a subject before your next block and it will group here." : "Add a subject like ECE 330 before starting and your sessions will group here."}
          </p>
        )}
        {h.subjects.length > 0 && unlabeled > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{unlabeled} earlier {unlabeled === 1 ? "block has" : "blocks have"} no subject and {unlabeled === 1 ? "isn't" : "aren't"} grouped.</p>}
      </div>
      {sessions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nothing logged yet. Finish one focus phase and it lands here, ready for a short reflection.</p>
      ) : (
        <ul className="mt-4 max-h-96 space-y-1 overflow-auto">
          {sessions.map((s) => (
            <li key={s.id} className={cn("group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-sm hover:bg-secondary sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]", activeId === s.id && "bg-[var(--gold)]/10")} data-testid={`row-log-${s.id}`}>
              <span className="font-mono text-xs text-gold">{s.minutes}m</span>
              <span className="min-w-0">
                <span className="block truncate">{s.task}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">{[s.subject, s.intention, format(s.completedAt, "MMM d, h:mm a")].filter(Boolean).join(" · ")}</span>
              </span>
              <button type="button" onClick={() => onOpen(s.id)} aria-label={`${s.reflection ? "Edit reflection for" : "Reflect on"} ${s.task}`}
                className={cn("inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px]", s.reflection ? "bg-[var(--gold)]/20 text-gold" : "border border-border text-muted-foreground hover:border-[var(--gold)]")} data-testid={`button-checkin-${s.id}`}>
                {s.reflection ? <Check className="h-3 w-3" /> : <NotebookPen className="h-3 w-3" />}{s.reflection ? "Edit" : "Reflect"}
              </button>
              <button type="button" aria-label={`Delete ${s.task}`} onClick={() => onDelete(s.id)} className="icon-action justify-self-end hover:bg-secondary hover:text-destructive" data-testid={`button-delete-log-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3"><DeviceNote /></div>
    </section>
  );
}
