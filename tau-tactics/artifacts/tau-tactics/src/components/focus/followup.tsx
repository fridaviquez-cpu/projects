import { useState } from "react";
import { ExternalLink, HelpCircle, RotateCcw, Sparkles } from "lucide-react";
import type { Session } from "@/lib/store";
import { sessionPrompt } from "@/lib/session-cycle";
import { CopyButton } from "@/components/shell";
import { cn } from "@/lib/utils";
import { promptKey, useDraft } from "@/lib/drafts";

type Mode = "quiz" | "review";
type Props = { session: Session; dirty: boolean; onSaveDraft: () => boolean };

export function FollowUp({ session, dirty, onSaveDraft }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [pending, setPending] = useState<Mode | null>(null);
  const base = mode ? sessionPrompt(session, mode) : "";
  const prompt = useDraft<string>(promptKey(session.id, mode ?? "quiz"));
  const text = prompt.value ?? base;
  const setText = prompt.set;

  const choose = (m: Mode) => { if (dirty) { setPending(m); return; } setPending(null); setMode(m); };

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="fu-h" data-testid="section-followup">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Practice · prompt builder</p>
      <h2 id="fu-h" className="mt-1 font-display text-xl font-semibold">Turn this block into practice</h2>
      <p className="mt-1 text-xs text-muted-foreground">This prepares a prompt from your saved session. TAU Tactics does not answer it and nothing is sent anywhere. You copy it into an assistant you choose.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {([["quiz", "Quiz me on what I just studied", HelpCircle], ["review", "Help me review this.", Sparkles]] as const).map(([m, label, Icon]) => (
          <button key={m} type="button" onClick={() => choose(m)} aria-pressed={mode === m}
            className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-all active:scale-95", mode === m ? "border-[var(--gold)] bg-[var(--gold)]/15 font-medium" : "border-border hover:border-[var(--gold)]")}
            data-testid={`button-followup-${m}`}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>
      {pending && (
        <div role="alert" className="mt-3 rounded-lg border border-[var(--gold)]/50 bg-[var(--gold)]/10 p-3 text-sm" data-testid="alert-unsaved">
          You have unsaved reflection edits. The prompt uses your saved reflection.
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { if (onSaveDraft()) { setMode(pending); setPending(null); } }} className="rounded-full bg-[var(--gold)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]" data-testid="button-save-and-prompt">Save edits and build prompt</button>
            <button type="button" onClick={() => { setMode(pending); setPending(null); }} className="rounded-full border border-border px-3 py-1.5 text-xs" data-testid="button-prompt-saved">Use saved version, keep my draft</button>
          </div>
        </div>
      )}
      {mode && (
        <div className="rise mt-4">
          <p role="status" className="mb-2 text-xs text-muted-foreground">{!prompt.persisted ? "Could not save this prompt draft. Kept only in this tab; copy it before closing or reloading." : prompt.value !== null ? "Recovered prompt draft · kept on this device. Reset to rebuild from the saved reflection." : "Edits are kept as a separate draft for this session and prompt type."}</p>
          {!prompt.persisted && <button type="button" className="mb-2 rounded-full border px-3 py-2 text-xs" onClick={() => setText(text)}>Retry prompt save</button>}
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Editable prompt</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} className="mt-1 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs leading-relaxed focus:border-[var(--gold)] focus:outline-none" data-testid="input-followup-prompt" />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CopyButton text={text} label="Copy prompt" testId="button-copy-followup" />
            {prompt.value !== null && <button type="button" onClick={() => { if (confirm("Discard this prompt draft and rebuild from the saved reflection?")) setText(null); }} className="inline-flex min-h-9 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground" data-testid="button-reset-prompt"><RotateCcw className="h-3 w-3" />Reset</button>}
            <span className="flex-1" />
            <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline" data-testid="link-chatgpt">Open ChatGPT <ExternalLink className="h-3 w-3" /></a>
            <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline" data-testid="link-gemini">Open Gemini <ExternalLink className="h-3 w-3" /></a>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Links open a blank chat. Paste the prompt yourself; nothing is attached to the link.</p>
        </div>
      )}
    </section>
  );
}
