import { useEffect, useState } from "react";
import { useMutationState, useIsMutating } from "@tanstack/react-query";
import { useGetWorkspace } from "@workspace/api-client-react";
import { Link } from "wouter";
import { CheckCircle2, Cloud, Loader2, ShieldAlert, WifiOff } from "lucide-react";

const WRITES = new Set(["updatePreferences", "savePersonalization", "loadSampleData", "createHolding", "updateHolding", "deleteHolding", "createThesis", "updateThesis", "deleteThesis", "createBudgetEntry", "updateBudgetEntry", "deleteBudgetEntry", "setBudgetLimit", "updateLearningProgress", "confirmImageImport"]);
const isWrite = (key: readonly unknown[] | undefined, variables?: unknown) => {
  // A wrong quiz choice is learning feedback, not a failed save operation.
  if (key?.includes("updateLearningProgress") && (variables as { data?: { answer?: number } } | undefined)?.data?.answer !== undefined) return false;
  return Boolean(key?.some((part) => typeof part === "string" && WRITES.has(part)));
};

export function WorkspaceStatus() {
  const { data: workspace } = useGetWorkspace();
  const [online, setOnline] = useState(navigator.onLine);
  const saving = useIsMutating({ predicate: (mutation) => isWrite(mutation.options.mutationKey, mutation.state.variables) });
  const changes = useMutationState({
    filters: { predicate: (mutation) => isWrite(mutation.options.mutationKey, mutation.state.variables) },
    select: (mutation) => ({ status: mutation.state.status, at: mutation.state.submittedAt }),
  });
  const latest = [...changes].sort((a, b) => b.at - a.at)[0];
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const hasRecords = Boolean(workspace && (workspace.holdings.length || workspace.theses.length || workspace.entries.length));
  return (
    <div className="mb-6 space-y-2" data-testid="workspace-status">
      <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {!online ? <span className="flex items-center gap-2 text-destructive"><WifiOff className="h-3.5 w-3.5" />You're offline. Keep drafts open and save after reconnecting.</span>
          : saving ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving changes…</span>
          : latest?.status === "error" ? <span className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-3.5 w-3.5" />The last change didn't save. Check the message and try again.</span>
          : <span className="flex items-center gap-2">{latest?.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-chart-2" /> : <Cloud className="h-3.5 w-3.5" />}{latest?.status === "success" ? "Changes saved to your workspace" : "Private workspace connected"} · No login needed</span>}
      </div>
      {hasRecords && !workspace?.hasRecoveryKey && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2.5 text-xs" data-testid="recovery-reminder">
          <span className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />Keep access if you clear cookies or change devices.</span>
          <Link href="/settings#recovery" className="font-medium underline underline-offset-4">Set up a recovery key</Link>
        </div>
      )}
    </div>
  );
}
