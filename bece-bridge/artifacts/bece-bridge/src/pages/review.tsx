import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListReviewFeedback, getListReviewFeedbackQueryKey, useUpdateReviewFeedback,
  type ContentReport, type FeedbackUpdateStatus,
} from "@workspace/api-client-react";
import { Empty, ErrorState, PageHead, Skel, fmtDate } from "@/components/kit";
import { LoginGate, errMsg } from "@/components/materials-kit";
import { REPORT_CATEGORIES } from "@/components/report-control";

const STATUSES: FeedbackUpdateStatus[] = ["open", "reviewing", "resolved", "dismissed"];
const label = (c: string) => REPORT_CATEGORIES.find((x) => x.value === c)?.label ?? c;

export default function ReviewPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const key = [...getListReviewFeedbackQueryKey(), user?.id ?? "anon"];
  const feed = useListReviewFeedback({ query: { queryKey: key, enabled: isAuthenticated, retry: false } });
  const [filter, setFilter] = useState<FeedbackUpdateStatus | "all">("open");
  const status = (feed.error as { status?: number } | null)?.status;
  const rows = (feed.data ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <div>
      <PageHead eyebrow="Review" title="Reported drafts">Student reports on generated drafts. Only the report is shown here, never private lecture content. You can change a report's status.</PageHead>
      {authLoading ? <Skel className="h-40" /> : !isAuthenticated ? <LoginGate>The review queue is for course reviewers. Log in with a reviewer account.</LoginGate>
        : feed.isLoading ? <div className="grid gap-3">{[1, 2, 3].map((i) => <Skel key={i} className="h-24" />)}</div>
          : status === 403 ? (
            <div className="rounded-lg border bg-card p-8 text-center" data-testid="state-access-required">
              <ShieldAlert className="h-6 w-6 text-accent mx-auto" />
              <p className="font-display text-xl font-semibold mt-3">Reviewer access required</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Your account is signed in but does not have the reviewer role. Ask a course maintainer to grant access.</p>
            </div>
          ) : feed.isError ? <ErrorState title={errMsg(feed.error, "Could not load reports")} onRetry={() => feed.refetch()} />
            : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(["all", ...STATUSES] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} data-testid={`filter-status-${f}`}
                      className={`rounded-full border px-3 py-1 text-xs font-mono capitalize ${filter === f ? "border-accent bg-accent/10" : "bg-card hover:border-foreground/30"}`}>
                      {f} <span className="text-muted-foreground">{f === "all" ? feed.data?.length ?? 0 : feed.data?.filter((r) => r.status === f).length ?? 0}</span>
                    </button>
                  ))}
                </div>
                {!rows.length ? <Empty title={filter === "all" ? "No reports yet" : `No ${filter} reports`}>Reports students send from Studio and Library appear here.</Empty>
                  : <ul className="grid gap-3">{rows.map((r) => <ReportRow key={r.id} r={r} queryKey={key} />)}</ul>}
              </>
            )}
    </div>
  );
}

function ReportRow({ r, queryKey }: { r: ContentReport; queryKey: readonly unknown[] }) {
  const qc = useQueryClient();
  const upd = useUpdateReviewFeedback();
  const set = (s: FeedbackUpdateStatus) => upd.mutate({ id: r.id, data: { status: s } }, {
    onSuccess: (n) => qc.setQueryData<ContentReport[]>(queryKey, (old) => old?.map((x) => (x.id === r.id ? { ...x, ...n } : x))),
  });
  return (
    <li className="rounded-lg border bg-card p-4" data-testid={`row-report-${r.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-accent">ECE {r.courseId} · {label(r.category)} · {fmtDate(r.createdAt)}</p>
          <p className="font-display font-semibold mt-0.5 truncate">{r.topic}</p>
          <p className="font-mono text-[10px] text-muted-foreground">draft {r.resourceId}</p>
        </div>
        <select value={r.status} disabled={upd.isPending} onChange={(e) => set(e.target.value as FeedbackUpdateStatus)} aria-label="Status" data-testid={`select-status-${r.id}`}
          className="rounded-md border bg-background px-2 py-1.5 text-sm capitalize">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p className="mt-3 text-sm whitespace-pre-wrap border-l-2 border-accent/40 pl-3">{r.comment}</p>
      {upd.isError && <p className="mt-2 text-xs text-destructive">{errMsg(upd.error, "Status update failed.")}</p>}
    </li>
  );
}
