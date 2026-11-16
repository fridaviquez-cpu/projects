import type { ReactNode } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Check, Minus } from "lucide-react";
import { useListCourses, getListCoursesQueryKey } from "@workspace/api-client-react";
import { CoverageTag, InstructionalTag, ErrorState, Empty, Eyebrow, Skel, Sources, btnAccent, btnGhost } from "@/components/kit";
import { OhmLab } from "@/components/ohm-lab";
import { DividerLab } from "@/components/divider-lab";
import { LogicLab } from "@/components/logic-lab";
import { KINDS, StudioPanel } from "@/pages/studio";
import { SharedStudy, hasSharedStudy } from "@/components/shared-study";

type Feature = { label: string; on: boolean; note: string };

function features(id: string, textOk: boolean): Feature[] {
  const shared: Feature[] = [
    { label: "Interactive visuals", on: true, note: "Describe what you want to see; AI proposes formula-based 2D plots (comparisons, finite sums, parameter sweeps) or uses a ready-made model. Arithmetic-checked, not physics-verified; no 3D or circuit solving." },
    { label: "Six Studio formats", on: textOk, note: "Module, study plan, flashcards, practice exam, cheat sheet, guided explanation." },
    { label: "Guided explanation", on: true, note: "Generate an explanation, then ask source-backed follow-up questions, request worked steps or explore a visual." },
    { label: "Practice exams", on: true, note: "Generated problems with worked answers. Unverified and not instructor-reviewed; check answers yourself." },
    { label: "Private lecture materials", on: true, note: "Upload your own permitted files to get page-cited drafts, separately or alongside shared selections." },
  ];
  const lectures: Feature = { label: "Shared study selections", on: hasSharedStudy(id), note: hasSharedStudy(id) ? "Licensed Wikibooks text for selected topics. Partial coverage, not official lectures or instructor-reviewed answers." : "No shared instructional selections for this course." };
  const scored: Feature = ["110","120","210","220"].includes(id)
    ? { label: "Scored diagnostics", on: true, note: `Three focused ECE ${id} skills with original lessons, reference solutions, and fresh-question rechecks. Not full course mastery.` }
    : { label: "Scored diagnostics", on: false, note: "No scored diagnostics for this course. Checks cover three focused skills each in ECE 110, 120, 210, and 220." };
  const lab: Feature =
    id === "110" ? { label: "Interactive lab", on: true, note: "Ohm's law and voltage divider labs." }
    : id === "120" ? { label: "Interactive lab", on: true, note: "Logic gate lab." }
    : id === "210" ? { label: "Interactive lab", on: true, note: "Circuit labs and the signal explorer, inside the ECE 210 lessons." }
    : id === "220" ? { label: "Code runner", on: false, note: "No compiled code runner. Studio can explain C and LC-3 code, but nothing is executed here." }
    : { label: "Course-specific lab", on: false, note: "No dedicated lab for this course. Use the general visual models where they apply." };
  return [...shared, scored, lab, lectures];
}

export default function CourseLearnPage() {
  const { id } = useParams<{ id: string }>();
  const courses = useListCourses({ query: { queryKey: getListCoursesQueryKey(), enabled: true } });
  const course = courses.data?.find((c) => c.id === id);

  if (courses.isLoading) return <div className="space-y-4"><Skel className="h-10 w-40" /><Skel className="h-16 w-2/3" /><Skel className="h-64" /></div>;
  if (courses.isError) return <ErrorState title="Could not load this workspace" onRetry={() => courses.refetch()} />;
  if (!course) return <Empty title="Course not found" action={<Link href="/" className={btnGhost}>Back to catalog</Link>}>That course ID is not in the catalog.</Empty>;
  if (!course.isPilot) {
    return (
      <Empty title={`No workspace for ${course.code}`} action={<Link href={`/courses/${course.id}`} className={btnGhost} data-testid="link-course-detail">View course details</Link>}>
        This course is catalog only. <Link href="/learn" className="text-accent underline" data-testid="link-learn-hub">See pilot workspaces</Link>.
      </Empty>
    );
  }
  const cid = course.id;
  const textOk = course.isPilot;

  return (
    <article className="rise">
      <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent mb-6" data-testid="link-back"><ArrowLeft className="h-4 w-4" /> {course.code} details</Link>
      <Eyebrow>{course.code} pilot workspace</Eyebrow>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-3 leading-tight" data-testid="text-workspace-title">{course.title}</h1>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <CoverageTag isPilot={course.isPilot} /><InstructionalTag value={course.instructionalCoverage} />
        <span className="font-mono text-xs text-muted-foreground">{course.credits} credit hours</span>
      </div>
      <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-foreground/85">{course.description}</p>
      <p className="mt-3 max-w-3xl text-sm rounded bg-accent/10 p-3 border-l-2 border-accent" data-testid="text-scope">
        Drafts retrieve relevant licensed shared selections for {course.code} when available. Other portions are labeled general AI.
        These are not official lectures. See topic coverage and source permissions below, or select your own permitted materials for private page-cited drafts.
      </p>
      {!!course.assessedConcepts?.length && <div className="mt-5 rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Scored skills</h2>
        <p className="text-sm my-3">{course.assessedConcepts.join(" · ")}</p>
        <Link href={`/learn?course=${cid}`} className={btnAccent} data-testid={`link-diagnostic-${cid}`}>Open ECE {cid} diagnostics <ArrowRight className="h-4 w-4" /></Link>
      </div>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-10 mt-10">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold mb-4">Studio for {course.code}</h2>
          <ul className="flex flex-wrap gap-2 mb-5">{KINDS.map((k) => <li key={k.kind} className="text-xs font-mono rounded border bg-card px-2 py-1">{k.label}</li>)}</ul>
          <StudioPanel key={cid} lockedCourseId={cid} />
          {hasSharedStudy(cid) && <SharedStudy courseId={cid} />}

          <Section title="Hands-on">
            {cid === "110" && <><OhmLab /><DividerLab /></>}
            {cid === "120" && <LogicLab />}
            {cid === "210" && (
              <div className="rounded-lg border bg-card p-5">
                <p className="text-sm">Original starter lessons, scored diagnostics for three skills, circuit labs, and the signal explorer live in the ECE 210 lessons. Numerical checks do not establish complete course mastery or instructor review.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/learn/210" className={btnAccent} data-testid="link-learn-210">Open lessons and diagnostics <ArrowRight className="h-4 w-4" /></Link>
                  <Link href="/learn/210#signal-lab" className={btnGhost} data-testid="link-signal-lab">Signal lab</Link>
                </div>
              </div>
            )}
            {!["110", "120", "210", "220"].includes(cid) && (
              <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground" data-testid="text-no-lab">
                No course-specific lab for {course.code}. Use Visuals above to describe a plot or comparison to compute.
              </p>
            )}
            {cid === "220" && (
              <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground" data-testid="text-no-runner">
                There is no compiled code runner here. Use a guided explanation to walk through C or LC-3 code, then run it in your course's own environment.
              </p>
            )}
          </Section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          <div className="rounded-lg border bg-card p-5" data-testid="card-availability">
            <p className="font-semibold mb-3">What is available</p>
            <ul className="space-y-3">
              {features(cid, textOk).map((f) => (
                <li key={f.label} className="flex gap-2 text-sm">
                  {f.on ? <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" /> : <Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <span><span className="font-medium">{f.label}</span><span className="block text-xs text-muted-foreground">{f.note}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2">Topics</p>
            {course.topics.length ? <ul className="flex flex-wrap gap-2">{course.topics.map((t) => <li key={t} className="text-xs rounded-full border bg-card px-2.5 py-1">{t}</li>)}</ul>
              : <p className="text-sm text-muted-foreground">No reviewed topic list yet.</p>}
          </div>
          <div>
            <p className="font-semibold mb-2">Sources</p>
            <Sources sources={course.sources} />
          </div>
        </aside>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-12"><h2 className="font-display text-2xl font-semibold mb-4">{title}</h2><div className="space-y-6">{children}</div></section>;
}
