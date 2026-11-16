import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, BookmarkCheck, ArrowRight } from "lucide-react";
import {
  useListCourses, getListCoursesQueryKey, useGetJourney, getGetJourneyQueryKey, useUpdateJourney, getGetBridgeSummaryQueryKey,
} from "@workspace/api-client-react";
import { CoverageTag, InstructionalTag, ErrorState, Empty, Eyebrow, Skel, Sources, btnAccent, btnGhost, btnPrimary } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const courses = useListCourses({ query: { queryKey: getListCoursesQueryKey(), enabled: true } });
  const journey = useGetJourney({ query: { queryKey: getGetJourneyQueryKey(), enabled: true } });
  const update = useUpdateJourney();
  const course = courses.data?.find((c) => c.id === id);
  const j = journey.data;
  const isSaved = !!j?.savedCourses.includes(id);

  const toggle = () => {
    if (!j) return;
    const savedCourses = isSaved ? j.savedCourses.filter((x) => x !== id) : [...j.savedCourses, id];
    update.mutate({ data: { savedCourses, weeklyHours: j.weeklyHours, goal: j.goal } }, {
      onSuccess: (nj) => {
        qc.setQueryData(getGetJourneyQueryKey(), nj);
        qc.invalidateQueries({ queryKey: getGetBridgeSummaryQueryKey() });
        toast({ title: isSaved ? "Removed from your journey" : "Saved for this browser" });
      },
      onError: () => toast({ title: "Could not update", description: "Please try again.", variant: "destructive" }),
    });
  };

  if (courses.isLoading) return <div className="space-y-4"><Skel className="h-10 w-40" /><Skel className="h-16 w-2/3" /><Skel className="h-40" /></div>;
  if (courses.isError) return <ErrorState title="Could not load this course" onRetry={() => courses.refetch()} />;
  if (!course) return <Empty title="Course not found" action={<Link href="/" className={btnGhost}>Back to catalog</Link>}>That course ID is not in the catalog.</Empty>;

  return (
    <article className="rise">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent-ink mb-6" data-testid="link-back"><ArrowLeft className="h-4 w-4" /> Catalog</Link>
      <div className="grid md:grid-cols-[1fr_320px] gap-10">
        <div>
          <Eyebrow>{course.code}</Eyebrow>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-3 leading-tight" data-testid="text-course-title">{course.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-4"><CoverageTag isPilot={course.isPilot} /><InstructionalTag value={course.instructionalCoverage} /><span className="font-mono text-xs text-muted-foreground">{course.credits} credit hours</span></div>
          <p className="mt-6 text-[15px] leading-relaxed text-foreground/85">{course.description}</p>

          <h2 className="font-display text-xl font-semibold mt-10 mb-3">Prerequisites</h2>
          <p className="text-sm font-mono bg-card border rounded-md p-3">{course.prerequisites || "None listed in sources."}</p>

          <h2 className="font-display text-xl font-semibold mt-10 mb-3">Topics</h2>
          {course.topics.length ? (
            <ul className="flex flex-wrap gap-2">{course.topics.map((t) => <li key={t} className="text-sm rounded-full border bg-card px-3 py-1">{t}</li>)}</ul>
          ) : <p className="text-sm text-muted-foreground">A structured topic list has not been reviewed yet. See the official description and sources.</p>}

          <h2 className="font-display text-xl font-semibold mt-10 mb-3">Sources</h2>
          <Sources sources={course.sources} />
        </div>
        <aside className="space-y-4 md:sticky md:top-24 self-start">
          <div className="rounded-lg border bg-card p-5">
            <button onClick={toggle} disabled={!j || update.isPending} data-testid="button-save-course" className={`${isSaved ? btnGhost : btnPrimary} w-full`}>
              {isSaved ? <><BookmarkCheck className="h-4 w-4 text-accent-ink" /> Saved — remove</> : <><Bookmark className="h-4 w-4" /> Save to journey</>}
            </button>
            <p className="text-xs text-muted-foreground mt-3">Saved for this browser via a private cookie. Not synced to any account.</p>
          </div>
          {course.isPilot ? (
            <div className="rounded-lg bg-primary text-primary-foreground p-5" data-testid="card-workspace">
              <p className="font-display text-lg font-semibold">Pilot workspace</p>
              <p className="text-sm opacity-80 mt-1">{course.instructionalCoverage}</p>
              <p className="text-xs opacity-70 mt-2">Six Studio formats locked to {course.code}. General AI drafts scoped to official course context unless you select your own permitted lecture materials.</p>
              <Link href={`/courses/${course.id}/learn`} className={`${btnAccent} mt-4 w-full`} data-testid="link-workspace">Open {course.code} workspace <ArrowRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Catalog only. No study workspace for this course yet. Pilot workspaces exist for ECE 110, 120, 210, and 220; browse them from the <Link href="/" className="text-accent-ink underline">catalog</Link>.
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
