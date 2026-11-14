import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import type { Preferences } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ErrorBlock, LoadingBlock } from "@/components/kit";
import { PreferenceQuestion } from "@/components/preference-question";
import { useToast } from "@/hooks/use-toast";
import { useDraftNavigationWarning } from "@/hooks/use-draft-guard";
import { sameAnswers, usePrefs, useSavePrefs } from "@/hooks/use-personalization";
import { QUESTIONS } from "@/lib/personalize";
import { errMsg } from "@/lib/money";

function Flow({ initial, saved }: { initial: Preferences; saved: Preferences }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Preferences>(initial);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [done, setDone] = useState(false);
  const save = useSavePrefs();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const q = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;
  const dirty = !done && !sameAnswers(draft, saved);
  useDraftNavigationWarning(dirty, "Your setup answers are not saved yet. Leave and discard them?");

  const persist = (status: Preferences["status"]) => {
    if (save.isPending) return;
    // Skip keeps previously SAVED answers and ignores this unsaved draft; only status changes.
    const data: Preferences = status === "skipped" ? { ...saved, status } : { ...draft, status };
    save.mutate({ data }, {
      onSuccess: () => {
        setDone(true);
        toast({ title: status === "completed" ? "Setup saved" : "Skipped for now", description: status === "completed" ? "Your overview, lessons and prompts now follow your answers." : "You can personalize any time from Settings." });
        navigate("/");
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-between gap-3">
        <p className="eyebrow" data-testid="text-onboarding-step">Personalize · {step + 1} of {QUESTIONS.length}</p>
        <button type="button" data-testid="button-skip-onboarding" onClick={() => (dirty ? setConfirmSkip(true) : persist("skipped"))} disabled={save.isPending} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50">Skip for now</button>
      </div>
      <div className="mb-10 h-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1}>
        <div className="h-full origin-left bg-accent transition-transform duration-500" style={{ transform: `scaleX(${(step + 1) / QUESTIONS.length})` }} />
      </div>
      <div key={q.key} className="rise">
        <PreferenceQuestion q={q} value={draft} onChange={setDraft} idPrefix="onb" disabled={save.isPending} />
      </div>
      {save.isError && <p role="alert" data-testid="status-onboarding-error" className="mt-6 text-sm text-destructive">Could not save: {errMsg(save.error)} Your answers are still here. Try again.</p>}
      <div className="mt-10 flex items-center justify-between gap-2">
        <Button variant="ghost" data-testid="button-onboarding-back" onClick={() => setStep(step - 1)} disabled={step === 0 || save.isPending}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        {last ? (
          <Button data-testid="button-finish-onboarding" onClick={() => persist("completed")} disabled={save.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">{save.isPending ? "Saving..." : "Save and show my overview"}</Button>
        ) : (
          <Button data-testid="button-onboarding-next" onClick={() => setStep(step + 1)} disabled={save.isPending}>Next<ArrowRight className="ml-2 h-4 w-4" /></Button>
        )}
      </div>
      <p className="mt-8 flex gap-2 text-xs leading-relaxed text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Every question is optional. Answers stay in this private workspace, change only how things are presented, and never connect to a brokerage. They are not used to recommend investments or returns.</p>
      <AlertDialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Skip and discard these answers?</AlertDialogTitle>
            <AlertDialogDescription>Answers you picked here have not been saved. Skipping keeps whatever was saved before and discards this draft.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-answering">Keep answering</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-skip" onClick={() => { setConfirmSkip(false); persist("skipped"); }}>Skip for now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Onboarding() {
  const { query } = usePrefs();
  if (query.isLoading) return <div className="mx-auto max-w-2xl"><LoadingBlock rows={2} /></div>;
  if (query.isError || !query.data) return <ErrorBlock message={`Your setup answers didn't load. ${errMsg(query.error)}`} onRetry={() => query.refetch()} />;
  // Flow seeds its draft with useState once, so background refetches never reset the form.
  return <Flow initial={query.data} saved={query.data} />;
}
