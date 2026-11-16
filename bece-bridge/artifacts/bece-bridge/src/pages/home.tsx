import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, ArrowRight, Bookmark } from "lucide-react";
import {
  useListCourses, getListCoursesQueryKey, useGetBridgeSummary, getGetBridgeSummaryQueryKey,
  useGetJourney, getGetJourneyQueryKey,
} from "@workspace/api-client-react";
import { BrandLogo } from "@/components/brand";
import { CoverageTag, InstructionalTag, ErrorState, Empty, Eyebrow, Skel, fmtDate, btnAccent } from "@/components/kit";

export default function Home() {
  const courses = useListCourses({ query: { queryKey: getListCoursesQueryKey(), enabled: true } });
  const summary = useGetBridgeSummary({ query: { queryKey: getGetBridgeSummaryQueryKey(), enabled: true } });
  const journey = useGetJourney({ query: { queryKey: getGetJourneyQueryKey(), enabled: true } });
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [cov, setCov] = useState<string>("all");
  const s = summary.data;
  const saved = new Set(journey.data?.savedCourses ?? []);

  const levels = useMemo(() => Array.from(new Set((courses.data ?? []).map((c) => Math.floor(c.level / 100) * 100))).sort(), [courses.data]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (courses.data ?? []).filter((c) =>
      (level === "all" || Math.floor(c.level / 100) * 100 === Number(level)) &&
      (cov === "all" || (cov === "pilot" ? c.isPilot : !c.isPilot)) &&
      (!t || [c.code, c.title, c.description, ...c.topics].join(" ").toLowerCase().includes(t)));
  }, [courses.data, q, level, cov]);

  const pilots = useMemo(() => (courses.data ?? []).filter((c) => c.isPilot), [courses.data]);
  return (
    <div>
      <section className="rise grid md:grid-cols-[1.4fr_1fr] gap-8 items-end mb-12">
        <div>
          <Eyebrow>For Illinois ECE students</Eyebrow>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold leading-[0.95] mt-4">
            Find your footing<br />in the <span className="text-accent-ink">real</span> curriculum.
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl leading-relaxed">
            Browse the ECE course catalog with links back to its sources. {s ? `${s.pilotCount} pilot` : "Pilot"} course
            workspaces each bundle the course's topics, sources, and six Studio formats. Scored diagnostics cover three focused skills each in ECE 110, 120, 210, and 220: diagnostic, focused lesson, practice, then a recheck.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/learn#diagnostics" className={btnAccent} data-testid="link-start-diagnostic">Choose your diagnostic <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/resources" className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold hover:border-accent" data-testid="link-resources">Find tutoring and community <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
        <div className="space-y-4">
        <BrandLogo className="max-w-[280px] mx-auto md:ml-auto md:mr-0" />
        <div className="rounded-lg bg-primary text-primary-foreground p-5 grid-paper relative overflow-hidden">
          <p className="font-mono text-[11px] uppercase tracking-widest text-accent">Current coverage</p>
          {summary.isLoading ? <Skel className="h-24 mt-3 bg-white/10" /> : summary.isError ? (
            <p className="text-sm mt-3 opacity-80">Overview unavailable. <button className="underline" onClick={() => summary.refetch()}>Retry</button></p>
          ) : s && (
            <dl className="grid grid-cols-2 gap-4 mt-3">
              {[["Courses listed", s.courseCount], ["Pilot courses", s.pilotCount], ["Saved here", s.savedCount], ["Your attempts", s.assessmentCount]].map(([k, v]) => (
                <div key={k as string}><dt className="text-xs opacity-70">{k}</dt><dd className="font-display text-3xl font-extrabold" data-testid={`stat-${k}`}>{v}</dd></div>
              ))}
              <p className="col-span-2 text-[11px] font-mono opacity-60">Catalog checked {fmtDate(s.checkedAt)}</p>
            </dl>
          )}
        </div>
        </div>
      </section>

      <section className="mb-10" aria-labelledby="pilot-heading" data-testid="section-pilots">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 id="pilot-heading" className="font-display text-2xl font-semibold">Pilot workspaces</h2>
          {s && <span className="font-mono text-xs text-muted-foreground" data-testid="text-pilot-count">{s.pilotCount} courses</span>}
        </div>
        {courses.isLoading ? <div className="grid sm:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-32" />)}</div>
          : courses.isError ? <ErrorState title="Could not load pilot workspaces" onRetry={() => courses.refetch()} />
          : pilots.length === 0 ? <Empty title="No pilot workspaces listed">The catalog did not mark any course as a pilot.</Empty>
          : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {pilots.map((c) => (
                <li key={c.id}>
                  <Link href={`/courses/${c.id}/learn`} data-testid={`link-workspace-${c.id}`} className="group block h-full rounded-lg border border-l-4 border-l-accent bg-card p-5 hover:border-accent transition-colors">
                    <span className="font-mono text-sm text-accent">{c.code}</span>
                    <span className="block font-display text-lg font-semibold mt-1">{c.title}</span>
                    <span className="block text-sm text-muted-foreground mt-1">{c.instructionalCoverage}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium mt-3 group-hover:text-accent">Open workspace <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        <p className="text-xs text-muted-foreground mt-3">Studio drafts are general AI explanations scoped to official course context, not shared indexed lectures, unless you select your own permitted lecture materials. Generated practice exams are unverified.</p>
      </section>

      <section>
        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-5">
          <label className="relative flex-1">
            <span className="sr-only">Search courses</span>
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code, title or topic" data-testid="input-search"
              className="w-full rounded-md border bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-accent" />
          </label>
          <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} data-testid="select-level" className="rounded-md border bg-card px-3 py-2.5 text-sm">
            <option value="all">All levels</option>
            {levels.map((l) => <option key={l} value={l}>{l}-level</option>)}
          </select>
          <div role="group" aria-label="Coverage" className="flex rounded-md border bg-card p-1">
            {[["all", "All"], ["pilot", "Pilot"], ["catalog", "Catalog"]].map(([v, l]) => (
              <button key={v} onClick={() => setCov(v)} aria-pressed={cov === v} data-testid={`filter-${v}`}
                className={`px-3 py-1.5 text-sm rounded ${cov === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
        </div>

        {courses.isLoading ? (
          <div className="grid gap-3">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-24" />)}</div>
        ) : courses.isError ? <ErrorState title="Could not load the course catalog" onRetry={() => courses.refetch()} />
          : list.length === 0 ? (
            <Empty title="No courses match" action={<button className="text-accent-ink underline text-sm" onClick={() => { setQ(""); setLevel("all"); setCov("all"); }}>Clear filters</button>}>
              Try a course code like 210, or a topic like signals.
            </Empty>
          ) : (
            <>
              <p className="font-mono text-xs text-muted-foreground mb-3" data-testid="text-result-count">{list.length} of {courses.data?.length} courses</p>
              <ul className="divide-y border rounded-lg bg-card overflow-hidden">
                {list.map((c, i) => (
                  <li key={c.id} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <Link href={`/courses/${c.id}`} data-testid={`card-course-${c.id}`}
                      className="group grid md:grid-cols-[110px_1fr_auto] gap-2 md:gap-6 p-4 md:p-5 hover:bg-secondary/50 transition-colors">
                      <span className="font-mono text-sm font-medium text-accent-ink">{c.code}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="font-display text-lg font-semibold">{c.title}</span>
                          <CoverageTag isPilot={c.isPilot} />{c.isPilot && <InstructionalTag value={c.instructionalCoverage} />}
                          {saved.has(c.id) && <Bookmark className="h-3.5 w-3.5 fill-accent text-accent-ink" aria-label="Saved" />}
                        </span>
                        <span className="block text-sm text-muted-foreground line-clamp-2 mt-1">{c.description}</span>
                      </span>
                      <span className="hidden md:flex items-center gap-3 text-xs font-mono text-muted-foreground">
                        {c.credits} cr <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
      </section>
    </div>
  );
}
