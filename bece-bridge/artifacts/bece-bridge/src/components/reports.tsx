import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Flag, ChevronDown, CheckCircle2, RotateCw } from "lucide-react";
import {
  useCreateResourceReport, useListMyReports, getListMyReportsQueryKey,
  type ResourceReport, type ResourceReportInputCategory,
} from "@workspace/api-client-react";
import { apiErrorMessage } from "@/lib/api-error";
import { btnAccent, btnGhost, fmtDate, Skel } from "@/components/kit";

export const CATEGORIES: { value: ResourceReportInputCategory; label: string }[] = [
  { value: "course-scope", label: "Incorrect course scope" },
  { value: "equation", label: "Equation is wrong" },
  { value: "solution", label: "Worked solution is wrong" },
  { value: "missing-information", label: "Missing information" },
  { value: "diagram", label: "Diagram or figure problem" },
  { value: "citation", label: "Citation or source problem" },
  { value: "too-basic", label: "Too basic for this course" },
  { value: "too-advanced", label: "Too advanced for this course" },
];
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

const STATUS_STYLE: Record<string, string> = {
  open: "bg-secondary text-foreground",
  "in-review": "bg-[hsl(42_80%_52%/0.25)] text-foreground",
  resolved: "bg-[hsl(160_45%_30%)] text-[hsl(36_33%_97%)]",
  dismissed: "border text-muted-foreground",
};
export function StatusTag({ status }: { status: string }) {
  return <span data-testid={`status-${status}`} className={`font-mono text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${STATUS_STYLE[status] ?? "border"}`}>{status.replace("-", " ")}</span>;
}

export function ReportForm({ resourceId, resourceTitle }: { resourceId: string; resourceTitle: string }) {
  const qc = useQueryClient();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ResourceReportInputCategory>("equation");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const create = useCreateResourceReport({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListMyReportsQueryKey() }); setSent(true); setDetails(""); } },
  });
  useEffect(() => { setSent(false); setOpen(false); setDetails(""); create.reset(); }, [resourceId]); // eslint-disable-line react-hooks/exhaustive-deps
  const len = details.trim().length;
  const valid = len >= 10 && len <= 4000;

  return (
    <section className="mt-8 rounded-lg border bg-background/60" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="m-0">
        <button type="button" aria-expanded={open} aria-controls={`${uid}-panel`} onClick={() => setOpen((o) => !o)} data-testid="button-toggle-report"
          className="w-full flex items-center gap-3 p-4 text-left text-sm font-semibold">
          <Flag className="h-4 w-4 text-accent-ink" aria-hidden />
          Report a problem with this resource
          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={`${uid}-panel`} className="pop px-4 pb-5">
          {sent ? (
            <div role="status" className="flex items-start gap-3 rounded-md bg-secondary p-4 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(160_45%_30%)]" aria-hidden />
              <div>
                <p className="font-medium">Report sent. Thank you.</p>
                <p className="text-muted-foreground">Track review updates under "Your reports" in the Library.</p>
                <button onClick={() => setSent(false)} className="mt-2 underline text-accent-ink" data-testid="button-report-another">Report something else</button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate({ id: resourceId, data: { category, details: details.trim() } }); }} className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed" id={`${uid}-disc`}>
                Shared with authorized reviewers: your report text, plus this resource's title ("{resourceTitle}"), course, topic, and reference ID.
                Not shared: the full resource content or your learning history.
              </p>
              <label className="block text-sm font-medium">Issue type
                <select value={category} onChange={(e) => setCategory(e.target.value as ResourceReportInputCategory)} data-testid="select-report-category"
                  className="mt-1 w-full rounded-md border bg-card p-2.5">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">What is wrong?
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={4000} required minLength={10}
                  aria-describedby={`${uid}-disc ${uid}-count`} data-testid="input-report-details"
                  placeholder="Point to the step, equation, or claim and say what you expected instead."
                  className="mt-1 w-full rounded-md border bg-card p-3 text-sm font-normal" />
                <span id={`${uid}-count`} className={`text-[11px] font-mono ${len > 0 && len < 10 ? "text-destructive" : "text-muted-foreground"}`}>
                  {len < 10 ? `${10 - len} more characters needed` : `${len}/4000`}
                </span>
              </label>
              {create.isError && <p role="alert" className="text-sm text-destructive">Could not send the report: {apiErrorMessage(create.error, "request failed")}. Your text is kept.</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={!valid || create.isPending} className={btnAccent} data-testid="button-submit-report">{create.isPending ? "Sending..." : "Send report"}</button>
                <button type="button" onClick={() => setOpen(false)} className={btnGhost} data-testid="button-cancel-report">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

export function MyReports() {
  const { user, isLoading } = useAuth();
  const q = useListMyReports({ query: { queryKey: [...getListMyReportsQueryKey(), user?.id ?? "anon"], enabled: !isLoading, refetchOnMount: "always", refetchOnWindowFocus: true } });
  const data: ResourceReport[] = q.data ?? [];
  return (
    <section className="mt-12" aria-labelledby="my-reports-h">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 id="my-reports-h" className="font-display text-2xl font-extrabold">Your reports</h2>
          <p className="text-sm text-muted-foreground">Problems you flagged and any reviewer response.</p>
        </div>
        <button onClick={() => q.refetch()} disabled={q.isFetching} className={`${btnGhost} py-2`} data-testid="button-refresh-my-reports">
          <RotateCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} aria-hidden /> Refresh
        </button>
      </div>
      {q.isLoading ? <Skel className="h-20" /> : q.isError ? (
        <p role="alert" className="text-sm text-destructive">Could not load your reports.</p>
      ) : !data.length ? (
        <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No reports yet. Use "Report a problem" on any resource.</p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {data.map((r) => (
            <li key={r.id} className="rounded-lg border bg-card p-4" data-testid={`row-my-report-${r.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag status={r.status} />
                <span className="text-xs font-mono text-muted-foreground">{categoryLabel(r.category)} · ECE {r.courseId} · {fmtDate(r.createdAt)}</span>
              </div>
              <p className="font-semibold mt-1.5">{r.resourceTitle}</p>
              <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap break-words">{r.details}</p>
              {r.reviewNote && (
                <div className="mt-3 border-l-2 border-accent pl-3 text-sm">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-accent-ink">Reviewer note · {fmtDate(r.updatedAt)}</p>
                  <p className="whitespace-pre-wrap break-words">{r.reviewNote}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
