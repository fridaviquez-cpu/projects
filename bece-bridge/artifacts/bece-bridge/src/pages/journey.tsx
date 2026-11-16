import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  useGetJourney, getGetJourneyQueryKey, useUpdateJourney, useListCourses, getListCoursesQueryKey, getGetBridgeSummaryQueryKey,
  type JourneyInput,
} from "@workspace/api-client-react";
import { Emblem } from "@/components/brand";
import { Empty, ErrorState, PageHead, Skel, btnAccent, btnGhost, btnPrimary, fmtDate } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";

export default function JourneyPage() {
  const search = useSearch();
  const selected = new URLSearchParams(search).get("course") ?? "210";
  const courseId = ["110","120","210","220"].includes(selected) ? selected : "210";
  const qc = useQueryClient();
  const { toast } = useToast();
  const journey = useGetJourney({ query: { queryKey: getGetJourneyQueryKey(), enabled: true } });
  const courses = useListCourses({ query: { queryKey: getListCoursesQueryKey(), enabled: true } });
  const update = useUpdateJourney();
  const [hours, setHours] = useState("6");
  const [goal, setGoal] = useState("");
  const init = useRef(false);
  const j = journey.data;

  useEffect(() => {
    if (j && !init.current) { init.current = true; setHours(String(j.weeklyHours)); setGoal(j.goal); }
  }, [j]);

  const save = (patch: Partial<JourneyInput>, msg: string) => {
    if (!j) return;
    update.mutate({ data: { savedCourses: j.savedCourses, weeklyHours: j.weeklyHours, goal: j.goal, ...patch } }, {
      onSuccess: (nj) => { qc.setQueryData(getGetJourneyQueryKey(), nj); qc.invalidateQueries({ queryKey: getGetBridgeSummaryQueryKey() }); toast({ title: msg }); },
      onError: () => toast({ title: "Could not save", description: "Check the values and try again.", variant: "destructive" }),
    });
  };
  const h = Number(hours);
  const hoursValid = Number.isInteger(h) && h >= 1 && h <= 40;

  if (journey.isLoading) return <div className="space-y-4"><Skel className="h-16 w-1/2" /><Skel className="h-40" /><Skel className="h-40" /></div>;
  if (journey.isError || !j) return <ErrorState title="Could not load your journey" onRetry={() => journey.refetch()} />;

  const saved = j.savedCourses.map((id) => courses.data?.find((c) => c.id === id) ?? { id, code: id, title: "" });

  return (
    <div>
      <PageHead eyebrow="Journey" title="Where you are">
        Assessment progress is stored for this browser via a private cookie and does not sync across devices. Private lecture materials and their generated drafts belong to your signed-in account.
      </PageHead>
      <nav aria-label="Progress course" className="flex flex-wrap gap-3 mb-6">
        {["110","120","210","220"].map(id=><Link key={id} href={`/journey?course=${id}`} className={id===courseId?btnAccent:btnGhost}>ECE {id}</Link>)}
      </nav>
      <div className="grid md:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">ECE {courseId} concept progress</h2>
            {!j.progress.length ? (
              <Empty title="No progress recorded" action={<Link href="/learn/210" className={btnAccent}>Take the diagnostic</Link>}>Progress appears after your first check.</Empty>
            ) : (
              <ul className="space-y-3">
                {j.progress.filter(p=>(p.courseId??"210")===courseId).map((p) => {
                  const pct = p.total ? (p.correct / p.total) * 100 : 0;
                  return (
                    <li key={p.concept} className="rounded-lg border bg-card p-4" data-testid={`progress-${p.concept}`}>
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="font-medium">{p.concept}</span>
                        <span className="font-mono text-xs text-muted-foreground">{p.correct}/{p.total} · <span className="text-accent-ink">{p.status}</span></span>
                      </div>
                      <div className="h-1.5 bg-muted rounded mt-3 overflow-hidden"><div className="h-full bg-accent origin-left transition-transform duration-700" style={{ transform: `scaleX(${pct / 100})` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">Assessment history</h2>
            {!j.attempts.some(a=>(a.courseId??"210")===courseId) ? <p className="text-sm text-muted-foreground">No attempts yet for ECE {courseId}.</p> : (
              <ul className="divide-y border rounded-lg bg-card">
                {j.attempts.filter(a=>(a.courseId??"210")===courseId).map((a) => (
                  <li key={a.id} className="p-4 grid grid-cols-[1fr_auto] gap-2">
                    <div>
                      <p className="font-medium capitalize">ECE {a.courseId ?? "210"} · {a.mode}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(a.createdAt)}</p>
                      <p className="text-sm text-muted-foreground mt-1">{a.recommendation}</p>
                    </div>
                    <p className="font-display text-2xl font-extrabold">{a.score}<span className="text-sm text-muted-foreground">/{a.total}</span></p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg bg-sidebar text-sidebar-foreground p-4 flex items-center gap-4">
            <Emblem className="h-16 w-16 shrink-0" title="BECE Bridge emblem" />
            <p className="text-sm leading-snug"><span className="font-display font-bold block">Your bridge to success in ECE.</span><span className="opacity-70">Keep the torch lit, one concept at a time.</span></p>
          </div>
          <form className="rounded-lg border bg-card p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (hoursValid) save({ weeklyHours: h, goal: goal.trim() }, "Plan saved"); }}>
            <h2 className="font-display text-lg font-semibold">Your plan</h2>
            <label className="block">
              <span className="text-sm">Weekly study hours (1 to 40)</span>
              <input type="number" min={1} max={40} value={hours} onChange={(e) => setHours(e.target.value)} data-testid="input-hours"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent" />
              {!hoursValid && <span className="text-xs text-destructive">Enter a whole number from 1 to 40.</span>}
            </label>
            <label className="block">
              <span className="text-sm">Goal</span>
              <textarea value={goal} maxLength={500} rows={4} onChange={(e) => setGoal(e.target.value)} data-testid="input-goal"
                placeholder="e.g. Be comfortable with phasors before the first ECE 210 midterm"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
            <button type="submit" disabled={!hoursValid || update.isPending} className={`${btnPrimary} w-full`} data-testid="button-save-plan">{update.isPending ? "Saving..." : "Save plan"}</button>
          </form>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-display text-lg font-semibold mb-3">Saved courses</h2>
            {!saved.length ? <p className="text-sm text-muted-foreground">None yet. <Link href="/" className="text-accent-ink underline">Browse the catalog</Link>.</p> : (
              <ul className="space-y-2">
                {saved.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <Link href={`/courses/${c.id}`} className="flex-1 min-w-0 text-sm hover:text-accent-ink" data-testid={`link-saved-${c.id}`}>
                      <span className="font-mono text-accent-ink mr-2">{c.code}</span><span className="truncate">{c.title}</span>
                    </Link>
                    <button aria-label={`Remove ${c.code}`} disabled={update.isPending} onClick={() => save({ savedCourses: j.savedCourses.filter((x) => x !== c.id) }, "Course removed")}
                      className="p-1 text-muted-foreground hover:text-destructive" data-testid={`button-unsave-${c.id}`}><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/learn?course=${courseId}`} className={`${btnGhost} w-full mt-4`} data-testid="link-continue">Continue ECE {courseId} diagnostics</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
