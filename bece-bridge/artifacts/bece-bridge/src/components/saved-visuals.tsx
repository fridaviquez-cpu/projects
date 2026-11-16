import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { useListSavedVisuals, getListSavedVisualsQueryKey, useDeleteSavedVisual, useUpdateSavedVisual, type SavedVisual } from "@workspace/api-client-react";
import { VisualChart } from "./visual-chart";
import { RecipeEquations } from "./recipe-equations";
import { Sources, btnAccent, btnGhost, ErrorState } from "./kit";
import { apiErrorMessage } from "@/lib/api-error";

export function SavedVisuals() {
  const { user, isLoading } = useAuth();
  // Remount all local edits and mutation state across identity changes.
  return isLoading ? null : <VisualLibrary key={user?.id ?? "guest"} identity={user?.id ?? "guest"} />;
}

function VisualLibrary({ identity }: { identity: string }) {
  const qc = useQueryClient();
  const queryKey = [...getListSavedVisualsQueryKey(), identity];
  const list = useListSavedVisuals({ query: { queryKey, staleTime: 0, refetchOnMount: "always" } });
  const remove = useDeleteSavedVisual();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = list.data?.find(v => v.id === openId);
  return <section className="my-8 border-t pt-6" aria-label="Saved visuals">
    <h2 className="font-display text-xl font-semibold">Saved interactive visuals</h2>
    <p className="mt-1 mb-4 text-sm text-muted-foreground">Visuals save automatically. Account visuals and guest browser visuals are kept separate. Deleting a source material also deletes visuals derived from it.</p>
    {list.isLoading ? <p>Loading visuals…</p> : list.isError ? <ErrorState title={apiErrorMessage(list.error, "Could not load visuals.")} onRetry={() => list.refetch()} />
      : !list.data?.length ? <p className="text-sm text-muted-foreground">No saved visuals. <Link href="/studio?tab=visuals" className="underline">Create a visual</Link>.</p>
      : <ul className="space-y-2">{list.data.map(v => <li key={v.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
        <button className="flex-1 text-left" onClick={() => setOpenId(openId === v.id ? null : v.id)} data-testid={`open-visual-${v.id}`}>
          <span className="block font-medium">{v.result.title}</span>
          <span className="text-xs text-muted-foreground">ECE {v.result.courseId} · {v.prompt} · {new Date(v.createdAt).toLocaleDateString()}{!v.compatible && " · older model snapshot"}</span>
        </button>
        <button className={btnGhost} disabled={remove.isPending} onClick={() => {
          if (!window.confirm("Delete this saved visual? This cannot be undone.")) return;
          remove.mutate({ id: v.id }, { onSuccess: () => { if (openId === v.id) setOpenId(null); qc.invalidateQueries({ queryKey }); } });
        }} aria-label={`Delete ${v.result.title}`}>Delete</button>
      </li>)}</ul>}
    {remove.isError && <p role="alert" className="text-destructive text-sm">{apiErrorMessage(remove.error, "Could not delete visual.")}</p>}
    {open && !list.isError && <VisualEditor key={open.id} visual={open} onSaved={() => qc.invalidateQueries({ queryKey })} />}
  </section>;
}

function VisualEditor({ visual, onSaved }: { visual: SavedVisual; onSaved: () => void }) {
  const [current, setCurrent] = useState(visual);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(visual.result.controls.map(c => [c.key, String(c.value)])));
  const update = useUpdateSavedVisual();
  const result = current.result;
  const invalid = result.controls.some(c => {
    const value = Number(values[c.key]);
    return !values[c.key]?.trim() || !Number.isFinite(value) || value < c.min || value > c.max || (c.step === 1 && !Number.isInteger(value));
  });
  const dirty = result.controls.some(c => Number(values[c.key]) !== c.value);
  const compatible = visual.compatible && current.compatible;
  return <div className="mt-4 rounded-lg border bg-card p-5" data-testid="saved-visual-editor">
    <h3 className="font-display text-xl font-semibold">{result.title}</h3>
    <p className="text-sm mt-2">ECE {result.courseId} · Original request: {current.prompt}</p>
    {result.recipe ? <RecipeEquations recipe={result.recipe} panels={result.panels} controls={result.controls} /> : <p className="font-mono text-sm mt-2">{result.formula}</p>}
    {result.explanation && <p className="text-sm mt-2">{result.explanation}</p>}
    <VisualChart result={result} />
    <p className="text-xs my-3"><strong>Assumptions:</strong> {result.assumptions}</p>
    <p className="text-xs my-3">{result.grounding}</p>
    {!!result.sources?.length && <Sources sources={result.sources} />}
    {!compatible && <p role="alert" className="my-3 text-sm text-destructive">This model has changed. This is your original saved snapshot. Generate a new visual to use the current model; the old values will not be silently migrated.</p>}
    <fieldset disabled={!compatible || update.isPending} className="my-4 space-y-3">
      <legend className="font-medium">Saved parameters</legend>
      {result.controls.map(c => <label key={c.key} className="flex items-center justify-between gap-3 text-sm">
        {c.label} ({c.unit || "unitless"}; {c.min}–{c.max})
        <input type="number" aria-label={c.label} min={c.min} max={c.max} step={c.step} value={values[c.key] ?? ""}
          onChange={e => setValues(prev => ({ ...prev, [c.key]: e.target.value }))}
          className="w-28 border rounded bg-background px-2 py-1" />
      </label>)}
      {invalid && <p className="text-sm text-destructive">Enter valid values within the displayed ranges; integer controls require whole numbers.</p>}
      {dirty && <p className="text-xs text-muted-foreground">The plot shows saved values until you save your changes.</p>}
      <button className={btnAccent} disabled={invalid || !dirty || update.isPending} onClick={() => update.mutate({
        id: current.id, data: { values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) },
      }, { onSuccess: saved => { setCurrent(saved); onSaved(); } })}>{update.isPending ? "Saving…" : "Save parameter changes"}</button>
    </fieldset>
    {update.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(update.error, "Could not save. Your previous values are unchanged.")}</p>}
    {update.isSuccess && !dirty && <p role="status" className="text-sm">Changes saved.</p>}
    <Link className="text-sm underline" href={`/studio?tab=visuals&course=${encodeURIComponent(result.courseId)}&prompt=${encodeURIComponent(current.prompt)}`}>Edit request and generate a new visual</Link>
    <p className="text-xs text-muted-foreground mt-2">New generation uses an attempt. Reselect private sources and consent if needed. Model version: {current.modelVersion.slice(0, 12)}</p>
  </div>;
}
