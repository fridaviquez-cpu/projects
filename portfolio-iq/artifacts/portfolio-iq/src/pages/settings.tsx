import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, KeyRound, Lock, RefreshCcw, FileJson, AlertTriangle } from "lucide-react";
import { useCreateRecoveryKey, useGetWorkspace, useRestoreWorkspace, useUpdatePreferences, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Field, PageHeader } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { errMsg } from "@/lib/money";
import { useDraftNavigationWarning } from "@/hooks/use-draft-guard";
import { usePrefs } from "@/hooks/use-personalization";
import { PersonalizationSettings } from "@/components/personalization-settings";
import { labelFor } from "@/lib/personalize";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SettingsPage() {
  const ws = useGetWorkspace();
  const qc = useQueryClient();
  const { toast } = useToast();
  const prefs = useUpdatePreferences();
  const createKey = useCreateRecoveryKey();
  const restore = useRestoreWorkspace();
  const w = ws.data;
  const personalization = usePrefs();
  const experienceLabel = personalization.query.isLoading ? "Loading your optional answer…"
    : personalization.query.isError ? "Could not load your optional answer"
    : labelFor("experience", personalization.prefs?.experience ?? null) || "Not answered";
  const [name, setName] = useState(w?.name ?? "");
  const [goal, setGoal] = useState(w?.goal ?? "");
  const [setupDirty, setSetupDirty] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [restoreKey, setRestoreKey] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);
  const dirty = Boolean(w && (name !== w.name || goal !== w.goal));
  useDraftNavigationWarning(dirty || setupDirty || key !== null, key !== null
    ? "Your recovery key is shown only once. Have you copied or downloaded it? Leave this page anyway?"
    : "Your preferences or setup answers have unsaved changes. Leave this page and discard them?");
  useEffect(() => {
    if (window.location.hash !== "#recovery") return;
    const frame = requestAnimationFrame(() => {
      const section = document.getElementById("recovery");
      section?.scrollIntoView({ block: "start" }); section?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { if (w) { setName(w.name); setGoal(w.goal); } }, [w?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePrefs = (e: FormEvent) => {
    e.preventDefault();
    if (prefs.isPending || !w) return;
    // Experience is owned by Personalization; send the latest saved value unchanged.
    prefs.mutate({ data: { name: name.trim(), experience: w.experience, goal: goal.trim() } }, {
      onSuccess: (updated) => { qc.setQueryData(getGetWorkspaceQueryKey(), updated); setName(updated.name); setGoal(updated.goal); toast({ title: "Preferences saved" }); },
      onError: (err) => toast({ title: "Couldn't save", description: errMsg(err), variant: "destructive" }),
    });
  };
  const makeKey = () => createKey.mutate(undefined, {
    onSuccess: (r) => { setKey(r.key); setConfirmReplace(false); qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); },
    onError: (err) => toast({ title: "Couldn't create a key", description: errMsg(err), variant: "destructive" }),
  });
  const doRestore = () => restore.mutate({ data: { key: restoreKey.trim() } }, {
    onSuccess: async (newWs) => {
      setConfirmRestore(false); setRestoreKey(""); setKey(null);
      await qc.cancelQueries();
      const workspaceKey = getGetWorkspaceQueryKey();
      const workspaceQuery = qc.getQueryCache().find({ queryKey: workspaceKey, exact: true });
      // Keep the observed bootstrap query and update it in place. Removing it
      // detaches WorkspaceGate's observer, so it can miss the new workspace ID
      // and fail to remount Shell (retaining the previous assistant's state).
      qc.removeQueries({ predicate: (query) => query !== workspaceQuery });
      qc.getMutationCache().clear();
      qc.setQueryData(workspaceKey, newWs);
      toast({ title: "Workspace restored", description: "You're now in the workspace for that key." });
    },
    onError: (err) => { setConfirmRestore(false); setRestoreErr(errMsg(err)); },
  });
  const exportJson = () => {
    if (!w) return;
    const personalizationData = personalization.query.data;
    if (!personalizationData) { toast({ title: "Export unavailable", description: "Your setup answers haven't loaded yet, so the export would be incomplete. Try again in a moment.", variant: "destructive" }); return; }
    const { holdings, theses, entries, budgetLimits, name: n, experience: ex, goal: g, createdAt, updatedAt } = w;
    download(`portfolioiq-workspace-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), name: n, experience: ex, goal: g, createdAt, updatedAt, personalization: personalizationData, holdings, theses, entries, budgetLimits }, null, 2), "application/json");
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Your space, your terms." lede="No account, no email, no bank links. Here's exactly how your data is kept." />
      <div className="space-y-6">
        <section className="paper grid gap-6 p-6 md:grid-cols-[1fr_1.4fr]">
          <div><Lock className="h-5 w-5 text-accent" /><h2 className="mt-3 font-display text-2xl">How saving works</h2></div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Choose Save or Add to finish a form. Confirmed changes are stored on our server and remembered by a private cookie in this browser.</li>
            <li>Other visitors cannot access your workspace. Keep your recovery key secret and use a trusted browser.</li>
            <li className="text-foreground">If you clear cookies or switch browsers, you lose access, unless you've saved a recovery key.</li>
            <li>We don't connect to banks or brokers and never fetch live prices.</li>
          </ul>
        </section>

        <form onSubmit={savePrefs} className="paper space-y-4 p-6">
          <h2 className="font-display text-2xl">Preferences</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="What should we call you?" htmlFor="p-name"><Input id="p-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" data-testid="input-pref-name" /></Field>
            <div className="space-y-1.5"><p className="text-[13px] font-medium">Experience</p><p className="text-sm text-muted-foreground" data-testid="text-legacy-experience">{experienceLabel} <span className="text-xs">· edit in Personalization below</span></p></div>
          </div>
          <Field label="Your goal, in a sentence" htmlFor="p-goal"><Textarea id="p-goal" maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Build a calm, diversified base and add to it monthly." data-testid="input-pref-goal" /></Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={prefs.isPending || !dirty} data-testid="button-save-prefs">{prefs.isPending ? "Saving..." : "Save preferences"}</Button>
            {dirty && <><Button type="button" variant="ghost" disabled={prefs.isPending} onClick={() => { if (w) { setName(w.name); setGoal(w.goal); } }} data-testid="button-reset-prefs">Reset changes</Button><span className="text-xs text-muted-foreground" role="status">Unsaved changes</span></>}
          </div>
        </form>

        <PersonalizationSettings onDirtyChange={setSetupDirty} />

        <section id="recovery" tabIndex={-1} className="paper scroll-mt-6 p-6">
          <div className="flex items-start gap-3"><KeyRound className="mt-1 h-5 w-5 text-accent" /><div><h2 className="font-display text-2xl">Recovery key</h2><p className="text-sm text-muted-foreground">{w?.hasRecoveryKey ? "A key exists for this workspace. Creating a new one replaces it; the old key stops working." : "Create a key to open this workspace on another browser or after clearing cookies."}</p></div></div>
          {key ? (
            <div className="mt-5 rounded-xl border-2 border-dashed border-accent bg-accent/5 p-4" data-testid="panel-recovery-key">
              <p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-accent" />Shown once. Store it somewhere safe, like a password manager.</p>
              <code className="num mt-3 block break-all rounded-lg bg-primary p-3 text-sm text-primary-foreground" data-testid="text-recovery-key">{key}</code>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(key).then(() => toast({ title: "Copied to clipboard" }), () => toast({ title: "Copy failed. Select the key and copy manually.", variant: "destructive" }))} data-testid="button-copy-key"><Copy className="mr-2 h-4 w-4" />Copy</Button>
                <Button variant="outline" onClick={() => download("portfolioiq-recovery-key.txt", `PortfolioIQ recovery key\nKeep this secret. Anyone with it can open your workspace.\n\n${key}\n`, "text/plain")} data-testid="button-download-key"><Download className="mr-2 h-4 w-4" />Download</Button>
                <Button variant="ghost" onClick={() => setKey(null)} data-testid="button-hide-key">I've saved it</Button>
              </div>
            </div>
          ) : (
            <Button className="mt-5" onClick={() => (w?.hasRecoveryKey ? setConfirmReplace(true) : makeKey())} disabled={createKey.isPending} data-testid="button-create-key">{createKey.isPending ? "Creating..." : w?.hasRecoveryKey ? "Replace recovery key" : "Create recovery key"}</Button>
          )}
        </section>

        <section className="paper p-6">
          <div className="flex items-start gap-3"><RefreshCcw className="mt-1 h-5 w-5 text-accent" /><div><h2 className="font-display text-2xl">Restore a workspace</h2><p className="text-sm text-muted-foreground">Paste a key from another browser. This browser will switch to that workspace.</p></div></div>
          <form onSubmit={(e) => { e.preventDefault(); if (restore.isPending || prefs.isPending || createKey.isPending) return; setRestoreErr(null); if (!/^piq_[A-Za-z0-9_-]{43}$/.test(restoreKey.trim())) return setRestoreErr("Paste the complete recovery key, starting with piq_. You can find it in the file you downloaded or your password manager."); setConfirmRestore(true); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input type="password" autoComplete="off" spellCheck={false} value={restoreKey} onChange={(e) => setRestoreKey(e.target.value)} placeholder="Recovery key" className="num bg-background" aria-label="Recovery key" data-testid="input-restore-key" />
            <Button type="submit" variant="outline" disabled={restore.isPending || prefs.isPending || createKey.isPending} data-testid="button-restore">{restore.isPending ? "Restoring..." : "Restore"}</Button>
          </form>
          {restoreErr && <p role="alert" className="mt-2 text-sm text-destructive">{restoreErr}</p>}
        </section>

        <section className="paper flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><FileJson className="mt-1 h-5 w-5 text-accent" /><div><h2 className="font-display text-2xl">Export</h2><p className="text-sm text-muted-foreground">Download holdings, theses, budget entries, limits and your setup answers as JSON. Your recovery key is never included.</p></div></div>
          <Button variant="outline" onClick={exportJson} disabled={!w || !personalization.query.data} title={personalization.query.data ? undefined : "Waiting for your setup answers to load"} data-testid="button-export"><Download className="mr-2 h-4 w-4" />Export JSON</Button>
        </section>
      </div>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader><AlertDialogTitle className="font-display text-2xl font-normal">Replace your recovery key?</AlertDialogTitle><AlertDialogDescription>The current key will stop working immediately, on every device.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); makeKey(); }} data-testid="button-confirm-replace">Replace</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Switch to another workspace?</AlertDialogTitle>
            <AlertDialogDescription>This browser will leave the current workspace. {w?.hasRecoveryKey ? "Make sure you've saved its recovery key, or you won't be able to come back." : "The current workspace has no recovery key. Without one, you won't be able to return to it."} Consider exporting it first.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={restore.isPending}>Stay here</AlertDialogCancel><AlertDialogAction disabled={restore.isPending} onClick={(e) => { e.preventDefault(); if (!restore.isPending) doRestore(); }} data-testid="button-confirm-restore">{restore.isPending ? "Switching..." : "Switch workspace"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
