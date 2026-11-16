import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { LogIn, LogOut, ShieldAlert, ShieldCheck, RotateCw } from "lucide-react";
import {
  useListAdminReports, useReviewResourceReport, getListAdminReportsQueryKey, getListMyReportsQueryKey,
  type ResourceReport, type ReportReviewStatus,
} from "@workspace/api-client-react";
import { PageHead, Skel, Empty, ErrorState, btnAccent, btnGhost, btnPrimary, fmtDate } from "@/components/kit";
import { CATEGORIES, StatusTag, categoryLabel } from "@/components/reports";

const STATUSES: ReportReviewStatus[] = ["open", "in-review", "resolved", "dismissed"];
const statusOf = (e: unknown) => (e && typeof e === "object" && "status" in e ? Number((e as { status: unknown }).status) : 0);

export default function AdminReports() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const qc = useQueryClient();
  const lastUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isLoading) return;
    const id = user?.id ?? null;
    if (lastUser.current !== undefined && lastUser.current !== id) qc.removeQueries({ queryKey: getListAdminReportsQueryKey() });
    lastUser.current = id;
  }, [user?.id, isLoading, qc]);
  const doLogout = () => { qc.removeQueries({ queryKey: getListAdminReportsQueryKey() }); logout(); };

  return (
    <div>
      <PageHead eyebrow="Reviewer desk" title="Resource reports">
        Review problems students flagged on generated resources. Actions here change only a report's status and reviewer note. They never edit course data, lessons, or any student's saved resources.
      </PageHead>
      {isLoading ? <Skel className="h-32" /> : !isAuthenticated ? (
        <Gate icon={<LogIn className="h-5 w-5" />} title="Sign in to review reports" body="Reviewer access requires an account that has been provisioned as an administrator. Signing in does not affect student data saved in this browser.">
          <button onClick={login} className={btnAccent} data-testid="button-login">Log in</button>
        </Gate>
      ) : <AdminBody key={user!.id} userId={user!.id} onLogout={doLogout} name={user?.firstName || user?.email || "Signed in"} />}
    </div>
  );
}

function Gate({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="rise rounded-lg border bg-card p-8 max-w-xl">
      <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">{icon}</div>
      <h2 className="font-display text-2xl font-extrabold mt-4">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
      <div className="mt-5 flex gap-2">{children}</div>
    </div>
  );
}

function AdminBody({ onLogout, name, userId }: { onLogout: () => void; name: string; userId: string }) {
  const q = useListAdminReports({ query: { queryKey: [...getListAdminReportsQueryKey(), userId], retry: (n, e) => ![401, 403].includes(statusOf(e)) && n < 1, refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const [status, setStatus] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [course, setCourse] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const reports = q.data ?? [];
  const courses = useMemo(() => Array.from(new Set(reports.map((r) => r.courseId))).sort(), [reports]);
  const filtered = useMemo(() => reports.filter((r) =>
    (status === "all" || r.status === status) && (cat === "all" || r.category === cat) && (course === "all" || r.courseId === course) &&
    (!search.trim() || `${r.resourceTitle} ${r.topic} ${r.details}`.toLowerCase().includes(search.toLowerCase()))), [reports, status, cat, course, search]);
  const selected = reports.find((r) => r.id === sel) ?? null;
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, reports.filter((r) => r.status === s).length])), [reports]);

  const bar = (
    <div className="flex items-center gap-3 mb-6 text-sm">
      <ShieldCheck className="h-4 w-4 text-accent-ink" aria-hidden /><span data-testid="text-admin-user">{name}</span>
      <button onClick={onLogout} className={`${btnGhost} ml-auto py-1.5`} data-testid="button-logout"><LogOut className="h-4 w-4" /> Log out</button>
    </div>
  );
  const code = statusOf(q.error);
  if (q.isError && (code === 401 || code === 403)) return (<>{bar}
    <Gate icon={<ShieldAlert className="h-5 w-5" />} title={code === 401 ? "Session expired" : "Not a reviewer account"}
      body={code === 401 ? "Your sign-in is no longer valid. Log in again to continue." : "This account is signed in but has not been provisioned for report review. Access is granted by the project maintainers on the server; it cannot be enabled from this page."}>
      {code === 401 ? <button onClick={onLogout} className={btnAccent}>Log in again</button> : <button onClick={onLogout} className={btnGhost}>Use a different account</button>}
    </Gate></>);

  return (
    <div>
      {bar}
      {q.isLoading ? <div className="grid gap-2">{[1, 2, 3, 4].map((i) => <Skel key={i} className="h-16" />)}</div> : q.isError ? <ErrorState title="Could not load reports" onRetry={() => q.refetch()} /> : (
        <>
          <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Status filter">
            {(["all", ...STATUSES] as string[]).map((s) => (
              <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} data-testid={`filter-status-${s}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-accent"}`}>
                {s === "all" ? `All · ${reports.length}` : `${s.replace("-", " ")} · ${counts[s]}`}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-2 mb-5">
            <label className="text-xs font-medium">Category<select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 w-full rounded-md border bg-card p-2 text-sm" data-testid="filter-category">
              <option value="all">All categories</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
            <label className="text-xs font-medium">Course<select value={course} onChange={(e) => setCourse(e.target.value)} className="mt-1 w-full rounded-md border bg-card p-2 text-sm" data-testid="filter-course">
              <option value="all">All courses</option>{courses.map((c) => <option key={c} value={c}>ECE {c}</option>)}</select></label>
            <label className="text-xs font-medium">Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, topic, details" className="mt-1 w-full rounded-md border bg-card p-2 text-sm" data-testid="input-search-reports" /></label>
          </div>
          <p className="text-xs font-mono text-muted-foreground mb-3" aria-live="polite">Showing {filtered.length} of the {reports.length} most recent reports (list capped at 200). Full resource content is never included.
            <button onClick={() => q.refetch()} className="ml-3 inline-flex items-center gap-1 underline" data-testid="button-refresh-admin"><RotateCw className={`h-3 w-3 ${q.isFetching ? "animate-spin" : ""}`} aria-hidden />Refresh</button></p>
          {!filtered.length ? <Empty title={reports.length ? "No reports match these filters" : "No reports yet"}>{reports.length ? "Clear a filter to see more." : "Student reports will appear here."}</Empty> : (
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-5 items-start">
              <ul className="border rounded-lg bg-card divide-y max-h-[70vh] overflow-auto">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setSel(r.id)} aria-current={sel === r.id} data-testid={`button-report-${r.id}`}
                      className={`w-full text-left p-4 transition-colors ${sel === r.id ? "bg-secondary border-l-4 border-accent" : "hover:bg-muted/60"}`}>
                      <span className="flex items-center gap-2"><StatusTag status={r.status} /><span className="text-[11px] font-mono text-muted-foreground">ECE {r.courseId} · {fmtDate(r.createdAt)}</span></span>
                      <span className="block font-semibold mt-1 truncate">{r.resourceTitle}</span>
                      <span className="block text-xs text-muted-foreground truncate">{categoryLabel(r.category)} · {r.details}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {selected ? <ReviewPanel key={selected.id} r={selected} /> : <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground text-center">Select a report to review it.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewPanel({ r }: { r: ResourceReport }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ReportReviewStatus>(r.status);
  const [note, setNote] = useState(r.reviewNote ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "conflict"; text: string } | null>(null);
  useEffect(() => {
    setStatus(r.status);
    setNote(r.reviewNote);
  }, [r.version, r.status, r.reviewNote]);
  const review = useReviewResourceReport({
    mutation: {
      onSuccess: () => { setMsg({ kind: "ok", text: "Review saved." }); qc.invalidateQueries({ queryKey: getListAdminReportsQueryKey() }); qc.invalidateQueries({ queryKey: getListMyReportsQueryKey() }); },
      onError: (e) => {
        if (statusOf(e) === 409) { setMsg({ kind: "conflict", text: "Someone else updated this report. Latest version reloaded; check it and submit again." }); qc.invalidateQueries({ queryKey: getListAdminReportsQueryKey() }); }
        else setMsg({ kind: "err", text: "Could not save the review. Try again." });
      },
    },
  });
  const len = note.trim().length;
  const valid = len >= 1 && len <= 2000;
  return (
    <article className="pop rounded-lg border bg-card p-5 lg:sticky lg:top-24" aria-labelledby="review-h">
      <StatusTag status={r.status} />
      <h2 id="review-h" className="font-display text-2xl font-extrabold mt-2">{r.resourceTitle}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs mt-3 font-mono">
        <dt className="text-muted-foreground">Course</dt><dd>ECE {r.courseId}</dd>
        <dt className="text-muted-foreground">Topic</dt><dd className="break-words">{r.topic}</dd>
        <dt className="text-muted-foreground">Category</dt><dd>{categoryLabel(r.category)}</dd>
        <dt className="text-muted-foreground">Resource ref</dt><dd className="break-all">{r.resourceId}</dd>
        <dt className="text-muted-foreground">Generation</dt><dd className="break-all">{r.generationId}</dd>
        <dt className="text-muted-foreground">Filed</dt><dd>{fmtDate(r.createdAt)} · v{r.version}</dd>
      </dl>
      <p className="mt-4 text-sm whitespace-pre-wrap break-words rounded-md bg-muted p-3" data-testid="text-report-details">{r.details}</p>
      <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) { setMsg(null); review.mutate({ id: r.id, data: { status, reviewNote: note.trim(), version: r.version } }); } }}>
        <fieldset>
          <legend className="text-sm font-medium mb-1.5">Set status</legend>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <label key={s} className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" data-testid={`radio-status-${s}`} />{s.replace("-", " ")}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">Reviewer note (visible to the student)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} required data-testid="input-review-note"
            className="mt-1 w-full rounded-md border bg-background p-3 text-sm font-normal" />
          <span className="text-[11px] font-mono text-muted-foreground">{len}/2000{len === 0 ? " · required" : ""}</span>
        </label>
        <p className="text-xs text-muted-foreground">Saving updates this report only. Course data and the resource are not changed.</p>
        {msg && <p role={msg.kind === "ok" ? "status" : "alert"} className={`text-sm ${msg.kind === "ok" ? "text-[hsl(160_45%_28%)]" : "text-destructive"}`}>{msg.text}</p>}
        <button type="submit" disabled={!valid || review.isPending} className={btnPrimary} data-testid="button-save-review">{review.isPending ? "Saving..." : "Save review"}</button>
      </form>
    </article>
  );
}
