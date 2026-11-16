import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGenerateResource, getListResourcesQueryKey, getGetBridgeSummaryQueryKey, type Resource, type ResourceInputKind,
} from "@workspace/api-client-react";
import { ResourceWorkspace } from "@/components/resource-workspace";
import { apiErrorMessage, errorStatus } from "@/lib/api-error";
import { errMsg, usePilotCourses, type CourseId } from "@/components/materials-kit";
import { VisualsPanel } from "@/components/visuals-panel";
import { EvidenceProvider, ActiveEvidence, useEvidence } from "@/components/evidence-context";
import { PageHead, btnAccent, btnGhost } from "@/components/kit";

export const KINDS: { kind: ResourceInputKind; label: string; blurb: string }[] = [
  { kind: "module", label: "Study module", blurb: "A short structured unit on one topic." },
  { kind: "study-plan", label: "Study plan", blurb: "A week-by-week plan around your hours." },
  { kind: "flashcards", label: "Flashcards", blurb: "Question and answer pairs to drill." },
  { kind: "practice-exam", label: "Practice exam", blurb: "Problems with worked answers." },
  { kind: "cheat-sheet", label: "Cheat sheet", blurb: "One page of formulas and reminders." },
  { kind: "explanation", label: "Guided explanation", blurb: "Paste what confuses you; get a walkthrough." },
];

const PLACEHOLDER: Record<string, string> = {
  "110": "e.g. Kirchhoff's laws", "120": "e.g. Boolean logic and truth tables", "210": "e.g. Phasors and impedance",
  "220": "e.g. Pointers and arrays in C", "310": "e.g. Convolution of discrete-time signals", "313": "e.g. Conditional probability",
  "329": "e.g. Gauss's law and boundary conditions", "330": "e.g. Three-phase power", "333": "e.g. Solar panel power and irradiance",
  "340": "e.g. MOSFET small-signal model", "342": "e.g. Common-source amplifier gain",
};

export default function Studio() {
  return (
    <div>
      <PageHead eyebrow="Studio" title="Draft study material">
        Choose a course. Create study resources or explore a concept with an interactive visual.
      </PageHead>
      <details className="-mt-2 mb-6 rounded-md border bg-card p-3 text-xs text-muted-foreground" data-testid="details-studio-limits">
        <summary className="cursor-pointer font-medium text-foreground">Sources and limitations</summary>
        <p className="mt-2 leading-relaxed">For ECE 110, 120, 210, and 220, drafts retrieve relevant licensed shared selections when available; other portions are labeled general AI. These are not official lecture recordings or slides. See each course workspace for coverage and source permissions. Selecting your own permitted materials produces private page-cited drafts. Generated answers remain unverified and not instructor-reviewed. Visuals are formula-based 2D plots, either AI-proposed and arithmetic-checked (not physics-verified) or ready-made models; they are not arbitrary images, 3D, circuit solving, or full-course coverage. Scored diagnostics cover three focused skills each in ECE 110, 120, 210, and 220; other pilot courses have no scored checks.</p>
      </details>
      <StudioPanel />
    </div>
  );
}

/** Studio generator. Pass `lockedCourseId` to preselect and hide the course selector (used inside course workspaces). Remount with `key` on course change. */
export function StudioPanel(props: { lockedCourseId?: CourseId; initialKind?: ResourceInputKind }) {
  const { user, isAuthenticated } = useAuth();
  const [chosenCourse, setCourseId] = useState(() => new URLSearchParams(window.location.search).get("course") ?? "210");
  const courseId = props.lockedCourseId ?? chosenCourse;
  return <EvidenceProvider key={`${isAuthenticated ? user?.id : "anon"}:${courseId}`} courseId={courseId} setCourseId={setCourseId}>
    <StudioTools {...props} />
  </EvidenceProvider>;
}
function StudioTools(props: { lockedCourseId?: CourseId; initialKind?: ResourceInputKind }) {
  const [tab, setTab] = useState<"draft" | "visuals">(() => new URLSearchParams(window.location.search).get("tab") === "visuals" ? "visuals" : "draft");
  return (
    <div>
      <ActiveEvidence />
      <div role="tablist" aria-label="Studio mode" className="inline-grid grid-cols-2 gap-1 rounded-md bg-muted p-1 mb-6">
        {([["draft", "Text drafts"], ["visuals", "Visuals"]] as const).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`tab-studio-${t}`}
            className={`rounded px-4 py-1.5 text-sm font-medium ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      <div hidden={tab !== "draft"}><DraftPanel {...props} /></div>
      <div hidden={tab !== "visuals"}><VisualsPanel courseId={props.lockedCourseId} /></div>
    </div>
  );
}

function DraftPanel({ lockedCourseId, initialKind }: { lockedCourseId?: CourseId; initialKind?: ResourceInputKind }) {
  const pilots = usePilotCourses();
  const qc = useQueryClient();
  const gen = useGenerateResource();
  const { courseId, setCourseId, mode, setMode, picked, setPicked, consent, setConsent, validIds, ready: matsReady, mats, courseMats, isAuthenticated } = useEvidence();
  const [kind, setKind] = useState<ResourceInputKind>(initialKind ?? "module");
  const [topic, setTopic] = useState(() => lockedCourseId ? "" : (new URLSearchParams(window.location.search).get("topic") ?? "").slice(0, 1200));
  const [out, setOut] = useState<Resource | null>(null);
  const epoch = useRef(0);
  const evidenceKey = `${mode}:${validIds.join(",")}:${consent}`;
  useEffect(() => {
    epoch.current++; setOut(null); gen.reset();
    return () => { epoch.current++; };
  }, [evidenceKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const isExplain = kind === "explanation";
  const hasMats = courseMats.length > 0;
  const usesMats = mode !== "library";
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? p : [...p, id]);

  const run = () => {
    if (!matsReady || !pilots.options.some(c => c.id === courseId)) return;
    const current = ++epoch.current;
    setOut(null);
    gen.mutate({ data: usesMats
      ? { courseId, kind, topic: topic.trim(), sourceMode: mode, materialIds: validIds, processingConsent: consent }
      : { courseId, kind, topic: topic.trim(), sourceMode: "library" } }, {
      onSuccess: (r) => {
        if (current !== epoch.current) return;
        setOut(r);
        qc.invalidateQueries({ queryKey: getListResourcesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetBridgeSummaryQueryKey() });
      },
    });
  };

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground" data-testid="text-generation-policy">Limit: 20 generation attempts per UTC day for this browser, including failed attempts. Deleting a draft does not restore an attempt.</p>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-8">
        <div className="min-w-0">
          {lockedCourseId ? (
            <p className="mb-5 text-sm font-medium" data-testid="text-locked-course">Course: <span className="font-mono text-accent">ECE {courseId}</span> <span className="text-xs text-muted-foreground font-normal">(fixed in this workspace)</span></p>
          ) : (
          <label className="block mb-5 text-sm font-medium">
            Course
            <select value={courseId} disabled={gen.isPending} onChange={e => { setCourseId(e.target.value as typeof courseId); setOut(null); setTopic(""); gen.reset(); }} className="mt-1 w-full rounded-md border bg-card p-3" data-testid="select-course">
              {pilots.options.length ? pilots.options.map((c) => <option key={c.id} value={c.id}>{c.label}</option>) : <option value={courseId}>ECE {courseId}</option>}
            </select>
            {pilots.isError && <button type="button" onClick={() => pilots.refetch()} className="mt-1 text-xs text-destructive underline" data-testid="button-retry-courses">Course list failed. Retry</button>}
          </label>
          )}
          <div role="group" aria-label="Resource type" className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button key={k.kind} aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)} data-testid={`kind-${k.kind}`}
                className={`text-left rounded-md border p-3 transition-colors ${kind === k.kind ? "border-accent bg-accent/5" : "bg-card hover:border-foreground/30"}`}>
                <span className="block text-sm font-semibold">{k.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{k.blurb}</span>
              </button>
            ))}
          </div>
          <label className="block mt-6">
            <span className="text-sm font-medium">{isExplain ? "What are you stuck on?" : "Topic"}</span>
            {isExplain ? (
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1200} rows={7} data-testid="input-topic"
                placeholder="e.g. I don't see why the capacitor voltage in an RC circuit approaches the source exponentially instead of linearly..."
                className="mt-1 w-full rounded-md border bg-card p-3 text-sm outline-none focus:border-accent" />
            ) : (
              <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1200} data-testid="input-topic"
                placeholder={PLACEHOLDER[courseId] ?? "e.g. A topic from this course"}
                className="mt-1 w-full rounded-md border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent" />
            )}
            <span className="text-[11px] font-mono text-muted-foreground">{topic.length}/1200</span>
          </label>
          <fieldset className="mt-6 rounded-md border bg-card p-4" data-testid="section-sources">
            <legend className="px-1 text-sm font-medium">Sources</legend>
            {mode !== "library" && !hasMats && <button type="button" onClick={() => setMode("library")} className="mb-3 underline">Choose course library + general AI instead</button>}
            {!isAuthenticated ? (
              <p className="text-xs text-muted-foreground">Using the course library. <Link href="/materials" className="text-accent underline" data-testid="link-materials-login">Log in to add your lecture materials</Link>.</p>
            ) : mats.isLoading ? <div className="h-8 rounded bg-muted animate-pulse" />
              : mats.isError ? <p className="text-xs text-destructive">{errMsg(mats.error, "Could not load your materials.")} <button onClick={() => mats.refetch()} className="underline">Retry</button></p>
              : !hasMats ? (
                <p className="text-xs text-muted-foreground">No materials for ECE {courseId} yet. <Link href="/materials" className="text-accent underline" data-testid="link-upload-materials">Upload lecture materials</Link>.</p>
              ) : (
                <>
                  <div role="radiogroup" aria-label="Source mode" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                    {(["combined", "materials", "library"] as const).map((m) => (
                      <button key={m} role="radio" aria-checked={mode === m} disabled={gen.isPending} onClick={() => setMode(m)} data-testid={`mode-${m}`}
                        className={`rounded px-2 py-1.5 text-xs font-medium capitalize ${mode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{m === "materials" ? "My materials" : m}</button>
                    ))}
                  </div>
                  {usesMats && (
                    <>
                      <p className="mt-3 text-[11px] font-mono text-muted-foreground">Select up to 5 · {validIds.length}/5</p>
                      <ul className="mt-1 max-h-44 overflow-auto space-y-1">
                        {courseMats.map((m) => {
                          const on = picked.includes(m.id);
                          return (
                            <li key={m.id}><label className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-muted ${!on && picked.length >= 5 ? "opacity-50" : ""}`}>
                              <input type="checkbox" checked={on} disabled={gen.isPending || (!on && picked.length >= 5)} onChange={() => toggle(m.id)} className="accent-[hsl(var(--accent))]" data-testid={`checkbox-material-${m.id}`} />
                              <span className="truncate flex-1">{m.title}</span><span className="font-mono text-[10px] text-muted-foreground">{m.pageCount}p</span>
                            </label></li>
                          );
                        })}
                      </ul>
                      <label className="mt-3 flex gap-2 text-xs leading-relaxed cursor-pointer">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={gen.isPending} className="mt-0.5 accent-[hsl(var(--accent))]" data-testid="checkbox-consent" />
                        <span>I agree to send excerpts from selected materials to the AI provider for explanation, visuals and practice in this workspace session. Only use files you are allowed to share this way.</span>
                      </label>
                      {!matsReady && <p className="mt-2 text-[11px] text-muted-foreground">{validIds.length === 0 ? "Select at least one material." : "Consent is required to use your materials."}</p>}
                    </>
                  )}
                </>
              )}
          </fieldset>
          <button onClick={run} disabled={!topic.trim() || gen.isPending || !matsReady || !pilots.options.some(c => c.id === courseId)} className={`${btnAccent} mt-4 w-full`} data-testid="button-generate">
            {gen.isPending ? "Generating..." : "Generate"}
          </button>
        </div>

        <div aria-live="polite" className="min-w-0">
          {gen.isPending ? (
            <div className="rounded-lg border bg-card p-6 grid-paper">
              <p className="font-display text-lg font-semibold">Working on your draft</p>
              <p className="text-sm text-muted-foreground">This can take up to about a minute. Keep this tab open.</p>
              <div className="mt-5 h-1 bg-muted rounded overflow-hidden"><div className="h-full bg-accent trace" /></div>
              <div className="mt-6 space-y-2">{[90, 75, 82, 60].map((w) => <div key={w} className="h-3 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />)}</div>
            </div>
          ) : gen.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
              <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />{errorStatus(gen.error) === 429 ? "Generation temporarily limited" : "Generation did not finish"}</p>
              <p className="text-sm mt-1 break-words">{apiErrorMessage(gen.error, "The request failed or timed out.")}</p>
              <p className="text-sm text-muted-foreground mt-1">Your topic is still filled in. A timed-out request may have finished; check your Library before retrying. Failed attempts count toward quota.</p>
              <button onClick={run} disabled={errorStatus(gen.error) === 429} className={`${btnGhost} mt-4`} data-testid="button-retry-generate"><RotateCw className="h-4 w-4" /> Try again</button>
            </div>
          ) : out ? (
            <ResourceWorkspace resource={out} after={<Link href="/library" className="inline-block mt-6 text-sm text-accent-ink underline" data-testid="link-library">Saved to Library</Link>} />
          ) : (
            <div className="rounded-lg border border-dashed grid-paper p-10 text-center text-sm text-muted-foreground h-full flex flex-col justify-center">
              <p className="font-display text-xl text-foreground font-semibold">Your draft appears here</p>
              <p className="mt-2">Pick a type, describe the topic, then generate.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
