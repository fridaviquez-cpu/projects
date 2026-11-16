import { format } from "date-fns";
import { NotebookPen, X } from "lucide-react";
import type { Session } from "@/lib/store";
import { btn, CopyButton } from "@/components/shell";
import { ReviewNext } from "@/components/review-next";

export type Reflection = NonNullable<Session["reflection"]>;
export const emptyReflection = (s?: Session): Reflection => ({
  recalled: !!s?.reflection?.recalled,
  practiced: !!s?.reflection?.practiced,
  takeaway: s?.reflection?.takeaway ?? "",
  unclear: s?.reflection?.unclear ?? "",
});
export const sameReflection = (a: Reflection, b: Reflection) =>
  a.recalled === b.recalled && a.practiced === b.practiced && a.takeaway.trim() === b.takeaway.trim() && (a.unclear ?? "").trim() === (b.unclear ?? "").trim();

type Props = {
  session: Session;
  draft: Reflection;
  onChange: (r: Reflection) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
  isNew: boolean;
  draftStored: boolean;
  draftPersisted: boolean;
  saveError: string;
  onRetryDraft: () => void;
};

export function ReflectionPanel({ session: s, draft, onChange, onSave, onCancel, onClose, isNew, draftStored, draftPersisted, saveError, onRetryDraft }: Props) {
  const dirty = !sameReflection(draft, emptyReflection(s));
  const set = <K extends keyof Reflection>(k: K, v: Reflection[K]) => onChange({ ...draft, [k]: v });
  return (
    <section id="reflect" className="rise scroll-mt-24 rounded-2xl border border-[var(--gold)]/50 bg-card p-5" aria-labelledby="reflect-h" data-testid="section-reflect">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{isNew ? "Block finished · reflect when ready" : s.reflection ? "Edit reflection" : "Reflect"}</p>
          <h2 id="reflect-h" className="mt-1 font-display text-xl font-semibold leading-snug">{s.task}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {[s.subject, s.intention, `${s.minutes} min`, format(s.completedAt, "EEE h:mm a")].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close reflection" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="button-close-reflect"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Drafts stay separate from saved reflections. Closing or navigating keeps your draft on this browser when storage is available. This is not a backup.</p>
      {(saveError || !draftPersisted) && <div role="alert" className="mt-3 rounded-lg border border-border p-3 text-sm">
        <p>{saveError || "Could not save this draft on this device. It is only kept in this tab; copy it before closing or reloading."}</p>
        <button type="button" className="mt-2 rounded-full border px-3 py-2" onClick={onRetryDraft}>Retry draft save</button>
      </div>}
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <label className="block text-sm font-medium">What did you understand better?
          <textarea value={draft.takeaway} onChange={(e) => set("takeaway", e.target.value)} maxLength={200} rows={2} placeholder="e.g. Why KVL sums to zero around any closed loop"
            className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal focus:border-[var(--gold)] focus:outline-none" data-testid="input-takeaway" />
        </label>
        <label className="block text-sm font-medium">What still feels unclear?
          <textarea value={draft.unclear ?? ""} onChange={(e) => set("unclear", e.target.value)} maxLength={200} rows={2} placeholder="e.g. When to pick mesh over nodal analysis"
            className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal focus:border-[var(--gold)] focus:outline-none" data-testid="input-unclear" />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Optional honesty checks</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.recalled} onChange={(e) => set("recalled", e.target.checked)} className="h-4 w-4 accent-[#d4af37]" data-testid="checkbox-recalled" />I recalled key points without notes</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.practiced} onChange={(e) => set("practiced", e.target.checked)} className="h-4 w-4 accent-[#d4af37]" data-testid="checkbox-practiced" />I practiced or applied it</label>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!dirty && !!s.reflection} className={btn.gold} data-testid="button-save-reflect"><NotebookPen className="h-4 w-4" /> {s.reflection ? "Save changes" : "Save reflection"}</button>
          <button type="button" onClick={() => { if (confirm("Discard this draft and restore the saved reflection?")) onCancel(); }} disabled={!dirty && !draftStored} className="rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40" data-testid="button-cancel-reflect">Discard edits</button>
          <CopyButton text={`What I understood:\n${draft.takeaway}\n\nStill unclear:\n${draft.unclear ?? ""}\n\nRecalled without notes: ${draft.recalled}\nPracticed: ${draft.practiced}`} label="Copy reflection" testId="button-copy-reflection" />
          <span className="text-xs text-muted-foreground" aria-live="polite">{saveError || !draftPersisted ? "Not saved — keep a copy" : dirty ? (draftStored ? "Recovered draft · kept on this device, not yet saved as a reflection" : "Unsaved edits") : s.reflection ? "Reflection saved" : "Skip anything you like. Nothing here is graded."}</span>
        </div>
      </form>
      {s.reflection && !dirty && <div className="mt-4"><ReviewNext key={s.id} session={s} /></div>}
    </section>
  );
}
