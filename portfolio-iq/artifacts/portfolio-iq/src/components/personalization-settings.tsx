import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Compass, RotateCw } from "lucide-react";
import type { Preferences } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PreferenceQuestion } from "@/components/preference-question";
import { useToast } from "@/hooks/use-toast";
import { sameAnswers, usePrefs, useSavePrefs } from "@/hooks/use-personalization";
import { EMPTY_PREFS, QUESTIONS, hasAnswers, prefChips } from "@/lib/personalize";
import { errMsg } from "@/lib/money";

const STATUS_LABEL: Record<Preferences["status"], string> = { new: "Not set up yet", completed: "Set up", skipped: "Skipped for now" };

export function PersonalizationSettings({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { query, prefs } = usePrefs();
  const save = useSavePrefs();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Seed once; refetches never overwrite in-progress edits.
  useEffect(() => { if (prefs && draft === null) setDraft(prefs); }, [prefs, draft]);
  const dirty = Boolean(prefs && draft && !sameAnswers(draft, prefs));
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  if (query.isLoading || (prefs && !draft)) return <section className="paper h-40 animate-pulse p-6" aria-busy="true" aria-label="Loading setup answers" />;
  if (query.isError || !prefs || !draft) {
    return (
      <section className="paper p-6" role="alert">
        <h2 className="font-display text-2xl">Personalization</h2>
        <p className="mt-1 text-sm text-destructive">Your setup answers didn't load. {errMsg(query.error)}</p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()} data-testid="button-retry-personalization"><RotateCw className="mr-2 h-4 w-4" />Try again</Button>
      </section>
    );
  }

  const persist = (next: Preferences, title: string) => {
    if (save.isPending) return;
    // An explicit Save is not Skip, even when the user intentionally clears every answer.
    save.mutate({ data: { ...next, status: "completed" } }, {
      onSuccess: (p) => { setDraft(p); toast({ title }); },
      onError: (err) => toast({ title: "Couldn't save your answers", description: `${errMsg(err)} Your edits are still here.`, variant: "destructive" }),
    });
  };
  const chips = prefChips(prefs);

  return (
    <section className="paper space-y-6 p-6" data-testid="section-personalization" aria-labelledby="pers-h">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="pers-h" className="font-display text-2xl">Personalization</h2>
          <p className="text-sm text-muted-foreground">Optional answers that change what comes first, how lessons read, and which prompts appear. Never used to recommend investments.</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" data-testid="text-personalization-status">
            <span className="num rounded bg-secondary px-1.5 py-0.5">{prefs.status === "completed" && !hasAnswers(prefs) ? "No answers selected" : STATUS_LABEL[prefs.status]}</span>
            {chips.map((c) => <span key={c} className="rounded-full border px-2 py-0.5 text-muted-foreground">{c}</span>)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm"><Link href="/onboarding" data-testid="link-reopen-setup"><Compass className="mr-2 h-4 w-4" />Step-by-step setup</Link></Button>
      </div>
      <div className="space-y-6">
        {QUESTIONS.map((q) => <PreferenceQuestion key={q.key} q={q} value={draft} onChange={setDraft} compact idPrefix="set" disabled={save.isPending} />)}
      </div>
      {save.isError && <p role="alert" className="text-sm text-destructive" data-testid="status-personalization-error">Not saved: {errMsg(save.error)}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button onClick={() => persist(draft, "Answers saved")} disabled={!dirty || save.isPending} data-testid="button-save-personalization">{save.isPending ? "Saving..." : "Save answers"}</Button>
        {dirty && <Button variant="ghost" disabled={save.isPending} onClick={() => setConfirmReset(true)} data-testid="button-reset-personalization">Reset changes</Button>}
        <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={save.isPending || (!hasAnswers(prefs) && !hasAnswers(draft))} onClick={() => setConfirmClear(true)} data-testid="button-clear-personalization">Clear all answers</Button>
        {dirty && <span role="status" className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader><AlertDialogTitle className="font-display text-2xl font-normal">Discard your unsaved answers?</AlertDialogTitle><AlertDialogDescription>Your answers go back to what was last saved.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-reset-personalization" onClick={() => { setDraft(prefs); setConfirmReset(false); }}>Discard changes</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader><AlertDialogTitle className="font-display text-2xl font-normal">Clear all setup answers?</AlertDialogTitle><AlertDialogDescription>This clears the answers in this form, including unsaved edits. Choose Save answers afterward to apply it. Financial records will not change.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep answers</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-clear-personalization" onClick={() => { setDraft({ ...EMPTY_PREFS, status: prefs.status }); setConfirmClear(false); }}>Clear answers</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
