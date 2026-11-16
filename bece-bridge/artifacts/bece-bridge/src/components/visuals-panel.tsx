import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useComputeVisual, useGenerateVisual, useListCourses, getListCoursesQueryKey, useListVisualModels, getListVisualModelsQueryKey, type VisualResult } from "@workspace/api-client-react";
import { apiErrorMessage, errorStatus } from "@/lib/api-error";
import { errMsg } from "@/components/materials-kit";
import { VisualChart } from "@/components/visual-chart";
import { RecipeEquations } from "@/components/recipe-equations";
import { Sources, btnAccent, btnGhost } from "@/components/kit";
import { useEvidence } from "@/components/evidence-context";
import { useAuth } from "@workspace/replit-auth-web";
import { useUpdateSavedVisual, getListSavedVisualsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));

type Draft = Record<string, string>;
const toDraft = (r: VisualResult): Draft => Object.fromEntries(r.controls.map((c) => [c.key, String(c.value)]));

type VisualsProps = { courseId?: string; initialPrompt?: string; initialMaterialIds?: string[] };
export function VisualsPanel(props: VisualsProps) {
  const { user, isLoading } = useAuth();
  return isLoading ? null : <VisualsSession key={user?.id ?? "guest"} {...props} />;
}

function VisualsSession({ courseId: locked, initialPrompt = "", initialMaterialIds = [] }: VisualsProps) {
  const qc = useQueryClient();
  const save = useUpdateSavedVisual();
  const coursesQ = useListCourses({ query: { queryKey: getListCoursesQueryKey(), enabled: true } });
  const modelsQ = useListVisualModels({ query: { queryKey: getListVisualModelsQueryKey(), enabled: true } });
  const all = useMemo(() => [...(coursesQ.data ?? [])].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })), [coursesQ.data]);
  const { courseId, setCourseId, mode, setMode, picked, setPicked, consent, setConsent, validIds: validPicked, ready: evidenceReady, mats, courseMats, isAuthenticated } = useEvidence();
  const [includeAll, setIncludeAll] = useState(false);
  const selected = all.find((c) => c.id === courseId);
  const validCourse = !!selected;
  const listed = all.filter((c) => includeAll || c.isPilot || c.id === courseId);
  const seededPrompt = initialPrompt || new URLSearchParams(window.location.search).get("prompt")?.slice(0, 1200) || "";
  const [prompt, setPrompt] = useState(seededPrompt);
  const [result, setResult] = useState<VisualResult | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const gen = useGenerateVisual();
  const comp = useComputeVisual();
  const epoch = useRef(0);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const seededSourcesReady = !initialMaterialIds.length || (isAuthenticated && !mats.isLoading && !mats.isError && initialMaterialIds.every(id => validPicked.includes(id)));
  const matsReady = seededSourcesReady && evidenceReady;

  const resetAll = () => { epoch.current++; setResult(null); setDraft({}); gen.reset(); comp.reset(); save.reset(); };
  const evidenceKey = `${courseId}:${mode}:${validPicked.join(",")}:${consent}`;
  useEffect(() => { setPrompt(seededPrompt); resetAll(); }, [seededPrompt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { resetAll(); }, [evidenceKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { epoch.current++; }, []);

  const ranked = useMemo(() => {
    const ctx = tokens([selected?.title ?? "", selected?.description ?? "", ...(selected?.topics ?? [])].join(" "));
    return (modelsQ.data ?? []).map((m) => ({ m, score: [...tokens(m.title + " " + m.formula)].filter((t) => ctx.has(t)).length })).sort((a, b) => b.score - a.score).map((x) => x.m);
  }, [modelsQ.data, selected]);

  const pickCourse = (id: string) => { setCourseId(id); setPrompt(""); resetAll(); };
  const editPrompt = (p: string) => { setPrompt(p); if (result || gen.isError) resetAll(); };

  const generate = () => {
    if (!validCourse || !matsReady) return;
    resetAll();
    const my = epoch.current;
    const data = { courseId, prompt: prompt.trim(), sourceMode: mode, ...(mode !== "library" ? { materialIds: validPicked, processingConsent: consent } : {}) };
    gen.mutate({ data }, {
      onSuccess: (r) => { if (my !== epoch.current || r.courseId !== courseId) return; setResult(r); setDraft(toDraft(r)); qc.invalidateQueries({ queryKey: getListSavedVisualsQueryKey() }); },
    });
  };

  const paramErrors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const c of result?.controls ?? []) {
      const raw = draft[c.key] ?? "";
      const v = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(v)) e[c.key] = "Enter a number.";
      else if (v < c.min || v > c.max) e[c.key] = `Must be ${c.min} to ${c.max}.`;
      else if (c.step === 1 && !Number.isInteger(v)) e[c.key] = "Must be a whole number.";
    }
    return e;
  }, [draft, result]);
  const dirty = !!result && result.controls.some((c) => Number(draft[c.key]) !== c.value);
  const hasErr = Object.keys(paramErrors).length > 0;

  const apply = () => {
    if (!result || hasErr) return;
    const my = epoch.current;
    const values = Object.fromEntries(result.controls.map((c) => [c.key, Number(draft[c.key])]));
    if (result.savedId) {
      save.mutate({ id: result.savedId, data: { values } }, { onSuccess: saved => {
        if (my !== epoch.current) return;
        setResult(saved.result); setDraft(toDraft(saved.result));
        qc.invalidateQueries({ queryKey: getListSavedVisualsQueryKey() });
      } });
      return;
    }
    comp.mutate({ data: { courseId: result.courseId, model: result.model, values, ...(result.recipe ? { recipe: result.recipe } : {}) } }, {
      onSuccess: (r) => { if (my !== epoch.current) return; setResult((prev) => ({ ...r, grounding: r.grounding ?? prev?.grounding, sources: r.sources?.length ? r.sources : prev?.sources })); setDraft(toDraft(r)); },
    });
  };
  const resetDefaults = () => {
    if (!result) return;
    // Defaults come from a fresh compute with no overrides (server applies model defaults; no AI cost).
    const my = epoch.current;
    comp.mutate({ data: { courseId: result.courseId, model: result.model, values: {}, ...(result.recipe ? { recipe: result.recipe } : {}) } }, {
      onSuccess: (r) => { if (my !== epoch.current) return; setDraft(toDraft(r)); },
    });
  };

  const genStatus = errorStatus(gen.error);

  return (
    <section aria-labelledby="visuals-h" data-testid="section-visuals">
      <h2 id="visuals-h" className="sr-only">Visuals</h2>
      <p className="mb-4 text-xs text-muted-foreground" data-testid="text-visual-policy">Generating a visual uses one of your 20 shared daily attempts (UTC, text and visuals combined, failed attempts included). Adjusting parameters afterward does not use AI or attempts. Successful visuals save automatically to Library, {isAuthenticated ? "privately to your account" : "for this guest browser only"}. Apply changes to save edited parameters.</p>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8">
        <div className="min-w-0">
          {locked ? (
            <p className="mb-5 text-sm font-medium" data-testid="text-visual-locked-course">Course: <span className="font-mono text-accent">{selected?.code ?? `ECE ${locked}`}</span> <span className="text-xs text-muted-foreground font-normal">(fixed in this workspace)</span></p>
          ) : (
            <div className="mb-5">
              <label className="block text-sm font-medium">
                1. Choose your class
                <select value={validCourse ? courseId : ""} disabled={gen.isPending || coursesQ.isLoading} onChange={(e) => pickCourse(e.target.value)} className="mt-1 w-full rounded-md border bg-card p-3" data-testid="select-visual-course">
                  <option value="">{coursesQ.isLoading ? "Loading courses..." : "Select a course..."}</option>
                  {listed.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}{c.isPilot ? "" : " (catalog)"}</option>)}
                </select>
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} className="accent-[hsl(var(--accent))]" data-testid="checkbox-include-catalog" />
                Include all catalog courses
              </label>
              {coursesQ.isError && <button type="button" onClick={() => coursesQ.refetch()} className="mt-1 text-xs text-destructive underline" data-testid="button-retry-visual-courses">Course list failed. Retry</button>}
              {courseId && !coursesQ.isLoading && !validCourse && !coursesQ.isError && <p className="mt-1 text-xs text-destructive" data-testid="text-unknown-course">Course "{courseId}" is not in the catalog. Choose another.</p>}
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium">{locked ? "What do you need to see?" : "2. What do you need to see?"}</span>
            <textarea ref={promptRef} value={prompt} onChange={(e) => editPrompt(e.target.value)} maxLength={1200} rows={4} disabled={!validCourse || gen.isPending} data-testid="input-visual-prompt"
              placeholder={validCourse ? "e.g. Compare the DTFT magnitude of a 4-point moving average with its 8-point DFT samples" : "Choose a course first"}
              className="mt-1 w-full rounded-md border bg-card p-3 text-sm outline-none focus:border-accent disabled:opacity-60" />
            <span className="text-[11px] font-mono text-muted-foreground">{prompt.length}/1200 · at least 5 characters</span>
          </label>
          {validCourse && (
            <details className="mt-3" data-testid="list-visual-examples">
              <summary className="cursor-pointer text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Optional: ready-made model examples</summary>
              {modelsQ.isLoading ? <div className="mt-1.5 h-7 rounded bg-muted animate-pulse" />
                : modelsQ.isError ? <button type="button" onClick={() => modelsQ.refetch()} className="mt-1 text-xs text-destructive underline" data-testid="button-retry-models">Could not load models. Retry</button>
                : <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ranked.map((m) => (
                    <button key={m.id} type="button" disabled={gen.isPending} onClick={() => editPrompt(`Show ${m.title}`)} title={m.formula} data-testid={`button-example-${m.id}`}
                      className="rounded-full border bg-card px-3 py-1 text-xs text-left hover:border-accent">Show {m.title}</button>
                  ))}
                </div>}
            </details>
          )}
          {validCourse && (
            <fieldset className="mt-5 rounded-md border bg-card p-3" data-testid="section-visual-materials">
              <legend className="px-1 text-sm font-medium">Sources</legend>
              <label className="block mb-3 text-xs">Source mode
                <select value={mode} onChange={e => setMode(e.target.value as typeof mode)} disabled={gen.isPending || !!initialMaterialIds.length} className="mt-1 w-full rounded border bg-card p-2" data-testid="select-visual-source-mode">
                  <option value="library">Course library + general AI</option>
                  <option value="materials">Selected materials only</option>
                  <option value="combined">Materials + labeled AI supplementation</option>
                </select>
              </label>
              {!isAuthenticated ? <p className="text-xs text-muted-foreground">Guests use original lessons and course metadata. <Link href="/materials" className="text-accent underline" data-testid="link-visual-materials-login">Log in to use your materials</Link>.</p>
                : mats.isLoading ? <div className="h-8 rounded bg-muted animate-pulse" />
                : mats.isError ? <p className="text-xs text-destructive">{errMsg(mats.error, "Could not load your materials.")} <button type="button" onClick={() => mats.refetch()} className="underline">Retry</button></p>
                : !courseMats.length ? <p className="text-xs text-muted-foreground">No materials for {selected?.code}. <Link href="/materials" className="text-accent underline" data-testid="link-visual-upload">Upload</Link>.</p>
                : <>
                  <p className="text-[11px] font-mono text-muted-foreground">{initialMaterialIds.length ? "Sources preserved from this conversation" : mode === "library" ? "Private selections are not used in library mode" : "Shared across Studio tools"} · {validPicked.length}/5</p>
                  <ul className="mt-1 max-h-36 overflow-auto space-y-1">{courseMats.map((m) => {
                    const on = picked.includes(m.id);
                    return <li key={m.id}><label className="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-muted">
                      <input type="checkbox" checked={on} disabled={!!initialMaterialIds.length || gen.isPending || (!on && validPicked.length >= 5)} onChange={() => setPicked((p) => on ? p.filter((x) => x !== m.id) : [...p, m.id])} className="accent-[hsl(var(--accent))]" data-testid={`checkbox-visual-material-${m.id}`} />
                      <span className="truncate flex-1">{m.title}</span><span className="font-mono text-[10px] text-muted-foreground">{m.pageCount}p</span>
                    </label></li>;
                  })}</ul>
                  {validPicked.length > 0 && <label className="mt-2 flex gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={gen.isPending} className="mt-0.5 accent-[hsl(var(--accent))]" data-testid="checkbox-visual-consent" />
                    <span>I agree to send excerpts from selected materials to the AI provider for explanation, visuals and practice in this workspace session. Only use files you may share this way.</span>
                  </label>}
                  {!matsReady && <p className="mt-1 text-[11px] text-muted-foreground">Select at least one available material and authorize processing.</p>}
                </>}
            </fieldset>
          )}
          <button onClick={generate} disabled={!validCourse || !matsReady || prompt.trim().length < 5 || gen.isPending} className={`${btnAccent} mt-5 w-full`} data-testid="button-generate-visual">
            {gen.isPending ? "Generating visual..." : "Generate visual"}
          </button>
          <details className="mt-5 rounded-md border bg-card p-3 text-xs" data-testid="details-visual-coverage">
            <summary className="cursor-pointer font-medium">What visuals can and cannot do</summary>
            <div className="mt-2 space-y-2 text-muted-foreground leading-relaxed">
              <p>Describe what you want to see in your own words. AI proposes a formula-based recipe: one to four plots, each with up to four curves, such as comparisons (continuous DTFT against discrete DFT samples), finite sums, and parameter sweeps over a bounded range. The server checks that the formulas evaluate to finite numbers, and the plot is computed from them, not drawn by AI. Ready-made models are still used when they fit.</p>
              <p>Engineering diagrams support an unloaded resistor divider, a constant-gain negative-feedback loop, and a 2–6 state modulo counter. These use validated diagram data, never AI-generated code or SVG. Capabilities are chosen by concept, not course number.</p>
              <p>Limits: no unrestricted 3D surfaces, general circuit solving, arbitrary diagram topologies or images. Unsupported requests get an explicit message, never a substitute.</p>
              <p>Original lessons or selected private excerpts guide interpretation and model selection when available. Otherwise only course metadata is supplied. Formulas determine numerical plots and fixed topology templates determine diagrams; source links do not independently verify either. This does not mean every course PDF or the whole curriculum is indexed.</p>
            </div>
          </details>
        </div>

        <div aria-live="polite" className="min-w-0">
          {gen.isPending ? (
            <div className="rounded-lg border bg-card p-6 grid-paper" data-testid="status-visual-loading">
              <p className="font-display text-lg font-semibold">Building a formula-based plot</p>
              <div className="mt-5 h-1 bg-muted rounded overflow-hidden"><div className="h-full bg-accent trace" /></div>
              <div className="mt-6 h-56 rounded bg-muted animate-pulse" />
            </div>
          ) : gen.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" data-testid="status-visual-error">
              <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />{genStatus === 422 ? "More detail or a different representation needed" : genStatus === 429 ? "Generation temporarily limited" : "Visual did not finish"}</p>
              <p className="text-sm mt-1 break-words" data-testid="text-visual-error">{apiErrorMessage(gen.error, "The request failed or timed out.")}</p>
              <p className="text-sm text-muted-foreground mt-1">{genStatus === 422 ? "Your request is still filled in. Add the quantities, ranges, or formula you expect, or ask for a 2D plot or comparison instead. Failed attempts count toward the daily limit." : "Failed attempts count toward the daily limit."}</p>
              {genStatus === 422 && <button type="button" onClick={() => promptRef.current?.focus()} className={`${btnGhost} mt-4`} data-testid="button-edit-request">Edit request</button>}
              {genStatus !== 429 && genStatus !== 422 && <button onClick={generate} className={`${btnGhost} mt-4`} data-testid="button-retry-visual">Try again</button>}
            </div>
          ) : result ? (
            <div className="min-w-0 max-w-full rounded-lg border bg-card p-4 sm:p-5 rise" data-testid={`visual-result-${result.model}`}>
              <p className="font-mono text-[10px] uppercase tracking-wider text-accent">ECE {result.courseId} · {result.recipe ? "custom formula plot" : "computed model"}</p>
              <h3 className="font-display text-xl font-semibold" data-testid="text-visual-title">{result.title}</h3>
              {result.savedId && <Link href="/library" className="text-xs underline">Saved to Library</Link>}
              <p className="mt-2 text-sm text-muted-foreground">Explore the graphs, then adjust the parameters below.</p>
              {result.recipe && <p className="mt-1 text-xs text-muted-foreground" data-testid="badge-recipe-unverified">AI-generated model · arithmetic checked, not independently verified.</p>}
              <div className={`relative mt-4 transition-opacity ${dirty || comp.isPending ? "opacity-50" : ""}`}>
                <VisualChart result={result} />
                {dirty && !comp.isPending && <p className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-card border px-2 py-1 text-[11px] font-medium" data-testid="text-visual-stale">Visual shows previous values. Apply changes to update.</p>}
              </div>
              <fieldset className="mt-5 border-t pt-4" disabled={comp.isPending || save.isPending}>
                <legend className="text-sm font-medium">Parameters</legend>
                <div className="mt-2 space-y-4">
                  {result.controls.map((c) => {
                    const err = paramErrors[c.key];
                    const num = Number(draft[c.key]);
                    return (
                      <div key={c.key}>
                        <label htmlFor={`v-${c.key}`} className="flex justify-between text-xs"><span>{c.label}{c.unit && <span className="text-muted-foreground"> ({c.unit})</span>}</span><span className="font-mono text-muted-foreground">applied: {c.value}</span></label>
                        <div className="mt-1 flex items-center gap-3">
                          <input type="range" min={c.min} max={c.max} step={c.step} value={Number.isFinite(num) ? num : c.value} aria-label={`${c.label} slider`}
                            onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))} className="flex-1 accent-[hsl(var(--accent))]" data-testid={`slider-${c.key}`} />
                          <input id={`v-${c.key}`} type="number" inputMode="decimal" min={c.min} max={c.max} step={c.step} value={draft[c.key] ?? ""} aria-invalid={!!err} aria-describedby={err ? `e-${c.key}` : undefined}
                            onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))} className={`w-24 rounded border bg-background px-2 py-1 font-mono text-sm ${err ? "border-destructive" : ""}`} data-testid={`input-param-${c.key}`} />
                        </div>
                        {err && <p id={`e-${c.key}`} className="mt-1 text-[11px] text-destructive" data-testid={`error-param-${c.key}`}>{err}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={apply} disabled={!dirty || hasErr || comp.isPending} className={btnAccent} data-testid="button-apply-params">{comp.isPending ? "Computing..." : dirty ? "Apply changes" : "No changes"}</button>
                  <button type="button" onClick={() => setDraft(toDraft(result))} disabled={!dirty} className={btnGhost} data-testid="button-discard-params">Discard edits</button>
                  <button type="button" onClick={resetDefaults} className={btnGhost} data-testid="button-reset-defaults"><RotateCcw className="h-4 w-4" /> Reset defaults</button>
                </div>
                {comp.isError && <p role="alert" className="mt-2 text-xs text-destructive" data-testid="text-compute-error">{apiErrorMessage(comp.error, "Could not recompute.")} The visual still shows the last applied values.</p>}
                {save.isError && <p role="alert" className="mt-2 text-xs text-destructive">{apiErrorMessage(save.error, "Could not save changes.")} Your saved values have not changed.</p>}
              </fieldset>
              {result.explanation && <details className="mt-5 rounded-md border p-3" data-testid="details-visual-explanation">
                <summary className="cursor-pointer text-sm font-medium">Understand this visual</summary>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap break-words" data-testid="text-visual-explanation">{result.explanation}</p>
              </details>}
              <details className="mt-3 min-w-0 rounded-md border p-3" data-testid="details-visual-calculations">
                <summary className="cursor-pointer text-sm font-medium">Equations and calculation details</summary>
                <p className="mt-2 text-xs text-muted-foreground" data-testid="text-equations-label">Step-by-step breakdown built directly from the exact formulas used for the plots. Not mathematically verified.</p>
                {result.recipe ? <RecipeEquations recipe={result.recipe} panels={result.panels} controls={result.controls} /> : <code className="mt-3 block whitespace-pre-wrap break-all text-xs" data-testid="text-visual-formula">{result.formula}</code>}
              </details>
              <details className="mt-3 rounded-md border p-3" data-testid="details-visual-sources">
                <summary className="cursor-pointer text-sm font-medium">Assumptions and sources</summary>
                <p className="mt-3 text-xs leading-relaxed break-words" data-testid="text-visual-assumptions">{result.assumptions}</p>
                {result.grounding && <p className="mt-3 text-xs leading-relaxed break-words" data-testid="text-visual-grounding">{result.grounding} Context reflects the original request; edited values are illustrative.</p>}
                {!!result.sources?.length && <div className="mt-3" data-testid="list-visual-sources"><Sources sources={result.sources} /></div>}
              </details>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed grid-paper p-10 text-center text-sm text-muted-foreground h-full flex flex-col justify-center" data-testid="empty-visual">
              <p className="font-display text-xl text-foreground font-semibold">Your visual appears here</p>
              <p className="mt-2">{validCourse ? "Describe what you need to see, or tap a model, then generate." : "Choose your class to start."}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
