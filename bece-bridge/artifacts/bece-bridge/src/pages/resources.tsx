import { useMemo, useState } from "react";
import { Search, ArrowUpRight, Clock, PlayCircle, FileText, Globe, LifeBuoy, Users, ShieldCheck, Info } from "lucide-react";
import { useListCourses } from "@workspace/api-client-react";
import { CATEGORIES, resourcesForPilots, STANDING_LABEL, LINKS_CHECKED, type ResourceCategory, type CourseTag, type Standing } from "@/data/resources";
import { Eyebrow, Empty, ErrorState } from "@/components/kit";

const ICONS: Record<ResourceCategory, typeof Clock> = {
  "office-hours": Clock, videos: PlayCircle, pdfs: FileText, websites: Globe, campus: LifeBuoy, groups: Users,
};
const STANDING_CLS: Record<Standing, string> = {
  official: "bg-primary text-primary-foreground",
  "student-run": "bg-accent/15 text-accent",
  general: "bg-secondary text-secondary-foreground",
};

export default function ResourcesPage() {
  const catalog = useListCourses();
  const pilots = useMemo(() => (catalog.data ?? []).filter(c => c.isPilot).sort((a,b) => Number(a.id)-Number(b.id)), [catalog.data]);
  const resources = useMemo(() => resourcesForPilots(pilots), [pilots]);
  const courseOptions = [{ id: "all", label: "Any course" }, ...pilots.map(c => ({ id:c.id, label:c.code }))];
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ResourceCategory | "all">("all");
  const [course, setCourse] = useState<CourseTag>("all");

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return resources.filter((r) =>
      (cat === "all" || r.category === cat) &&
      (course === "all" || r.courses.includes(course) || r.courses.includes("all")) &&
      (!t || [r.title, r.description, r.source, r.note ?? ""].join(" ").toLowerCase().includes(t)));
  }, [q, cat, course, resources]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, resources.filter((r) => r.category === c.id && (course === "all" || r.courses.includes(course) || r.courses.includes("all"))).length])), [resources, course]);
  const reset = () => { setQ(""); setCat("all"); setCourse("all"); };

  return (
    <div>
      <section className="rise grid md:grid-cols-[1.3fr_1fr] gap-8 items-end mb-10">
        <div>
          <Eyebrow>Support hub</Eyebrow>
          <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-[0.95] mt-4">
            Help has <span className="text-accent">office hours</span>.<br />Find the people.
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl leading-relaxed">
            Tutoring, course pages, campus support and student groups, plus a few outside study materials. Public, no sign-in. Your private uploads stay in Library.
          </p>
        </div>
        <aside className="rounded-lg border bg-card p-5 text-sm space-y-3" data-testid="text-resources-disclaimer">
          <p className="flex gap-2"><ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" /><span><b>Official UIUC</b> links go to university pages. <b>Student-run</b> groups are listed by the department. <b>General supplement</b> items come from outside UIUC and do not replace your course.</span></p>
          <p className="flex gap-2 text-muted-foreground"><Info className="h-4 w-4 shrink-0 mt-0.5" /><span>No times are listed here; always confirm on the linked page. BECE Bridge is not endorsed by any listed group. Links reviewed {LINKS_CHECKED}; pages can change.</span></p>
        </aside>
      </section>

      <div role="group" aria-label="Category" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c.id]; const on = cat === c.id;
          return (
            <button key={c.id} onClick={() => setCat(on ? "all" : c.id)} aria-pressed={on} data-testid={`filter-category-${c.id}`}
              className={`text-left rounded-lg border p-3 transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-accent"}`}>
              <span className="flex items-center justify-between"><Icon className={`h-4 w-4 ${on ? "text-accent" : "text-accent"}`} /><span className="font-mono text-[11px] opacity-70">{counts[c.id]}</span></span>
              <span className="block font-semibold text-sm mt-2">{c.label}</span>
              <span className={`block text-xs mt-0.5 ${on ? "opacity-75" : "text-muted-foreground"}`}>{c.blurb}</span>
            </button>
          );
        })}
      </div>

      {catalog.isLoading && <p role="status" className="mb-4 text-sm">Loading pilot course resources…</p>}
      {catalog.isError && <ErrorState title="Could not load pilot course resources" onRetry={() => catalog.refetch()} />}
      <div className="flex flex-col gap-3 mb-5">
        <label className="relative flex-1">
          <span className="sr-only">Search resources</span>
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tutoring, capacitors, IEEE..." data-testid="input-resource-search"
            className="w-full rounded-md border bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-accent" />
        </label>
        <div role="group" aria-label="Course" className="flex flex-wrap rounded-md border bg-card p-1">
          {courseOptions.map((c) => (
            <button key={c.id} onClick={() => setCourse(c.id)} aria-pressed={course === c.id} data-testid={`filter-course-${c.id}`}
              className={`px-3 py-1.5 text-sm rounded ${course === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{c.label}</button>
          ))}
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground mb-3" aria-live="polite" data-testid="text-resource-count">{list.length} of {resources.length} resources{course !== "all" && ` · ${list.filter(r => !r.courses.includes("all")).length} course-specific · ${list.filter(r => r.courses.includes("all")).length} campus-wide`}</p>
      <p className="text-xs text-muted-foreground mb-4">Browse topic-matched videos and reading collections alongside course links. External supplements cover selected topics, not an entire UIUC syllabus. PDF cards may open a collection page with download links.</p>

      {list.length === 0 ? (
        <Empty title="Nothing matches yet" action={<button className="text-accent underline text-sm" onClick={reset} data-testid="button-clear-resource-filters">Clear filters</button>}>
          Try a broader word, or pick Any course.
        </Empty>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {list.map((r, i) => {
            const Icon = ICONS[r.category];
            return (
              <li key={r.id} className="rise rounded-lg border bg-card p-5 flex flex-col" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }} data-testid={`card-resource-${r.id}`}>
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                  <Icon className="h-4 w-4 text-accent" />
                  <span className={`px-1.5 py-0.5 rounded ${STANDING_CLS[r.standing]}`}>{STANDING_LABEL[r.standing]}</span>
                  <span className="text-muted-foreground">{r.courses.includes("all") ? "All courses" : r.courses.map((c) => `ECE ${c}`).join(" / ")}</span>
                </div>
                <h2 className="font-display text-lg font-semibold mt-3">{r.title}</h2>
                <p className="text-xs text-muted-foreground font-mono">{r.source}</p>
                <p className="text-sm mt-2 leading-relaxed">{r.description}</p>
                {r.note && <p className="text-xs text-muted-foreground mt-2 border-l-2 border-accent pl-2">{r.note}</p>}
                <a href={r.url} target="_blank" rel="noopener noreferrer" data-testid={`link-resource-${r.id}`}
                  className="mt-4 self-start inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                  {r.cta} <ArrowUpRight className="h-4 w-4" /><span className="sr-only">(opens in new tab)</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
