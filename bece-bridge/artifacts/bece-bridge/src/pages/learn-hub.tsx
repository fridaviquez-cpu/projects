import { Link, useSearch } from "wouter";
import Learn from "@/pages/learn";
import { ArrowRight } from "lucide-react";
import { ErrorState, Empty, PageHead, Skel, btnGhost } from "@/components/kit";
import { useMemo } from "react";
import { useListCourses, getListCoursesQueryKey } from "@workspace/api-client-react";

const LABS: Record<string, string> = {
  "110": "Ohm and divider labs",
  "120": "Logic gate lab",
  "210": "Lessons, scored diagnostics, signal explorer",
};

export default function LearnHub() {
  const q = useListCourses({ query: { queryKey: getListCoursesQueryKey(), enabled: true } });
  const { isLoading, isError, refetch } = q;
  const options = useMemo(() => (q.data ?? []).filter((c) => c.isPilot).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map((course) => ({ id: course.id, course })), [q.data]);
  const search = useSearch();
  if (new URLSearchParams(search).has("course")) return <Learn />;
  return (
    <div>
      <PageHead eyebrow="Learn" title="Pick a pilot workspace">
        Each pilot workspace has the Studio drafting formats, private lecture materials, and interactive visual models. Scored diagnostics cover three focused skills each in ECE 110, 120, 210, and 220; other courses have no scored checks.
      </PageHead>
      <section id="diagnostics" aria-label="Choose a scored diagnostic" className="scroll-mt-24 mb-8 rounded-lg border bg-card p-5">
        <h2 className="font-display text-xl font-semibold">Choose your diagnostic</h2>
        <p className="mt-2 text-sm text-muted-foreground">Start with one of the courses that currently has scored checks. Each samples three focused skills—not the full syllabus.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {["110", "120", "210", "220"].map(id => (
            <Link key={id} href={`/learn?course=${id}`} className={btnGhost} data-testid={`link-start-diagnostic-${id}`}>ECE {id} <ArrowRight className="h-4 w-4" /></Link>
          ))}
        </div>
      </section>
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }, (_, i) => <Skel key={i} className="h-32" />)}</div>
      ) : isError ? <ErrorState title="Could not load pilot courses" onRetry={() => refetch()} />
        : !options.length ? <Empty title="No pilot workspaces yet" action={<Link href="/" className={btnGhost}>Browse the catalog</Link>}>The catalog has no pilot courses right now.</Empty>
          : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {options.map(({ id, course }, i) => (
                <li key={id} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <Link href={`/courses/${id}/learn`} data-testid={`link-workspace-${id}`}
                    className="group flex h-full flex-col rounded-lg border bg-card p-5 hover:border-accent transition-colors">
                    <span className="font-mono text-xs text-accent">{course.code}</span>
                    <span className="font-display text-lg font-semibold mt-1 leading-snug">{course.title}</span>
                    <span className="mt-3 text-xs text-muted-foreground flex-1">{LABS[id] ?? "Studio drafts and interactive visual models"}</span>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium group-hover:text-accent">Open workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
    </div>
  );
}
