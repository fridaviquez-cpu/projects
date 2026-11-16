import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, ArrowLeft } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListResources, getListResourcesQueryKey, useDeleteResource, getGetBridgeSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MyReports } from "@/components/reports";
import { SavedVisuals } from "@/components/saved-visuals";
import { ResourceWorkspace } from "@/components/resource-workspace";
import { apiErrorMessage } from "@/lib/api-error";
import { Empty, ErrorState, PageHead, Skel, btnAccent, fmtDate } from "@/components/kit";

export default function LibraryPage() {
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const res = useListResources({ query: { queryKey: [...getListResourcesQueryKey(), user?.id ?? "anon"], enabled: !authLoading } });
  const del = useDeleteResource();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const open = res.data?.find((r) => r.id === openId);

  const remove = () => {
    if (!confirmId) return;
    const id = confirmId;
    del.mutate({ id }, {
      onSuccess: () => {
        if (openId === id) setOpenId(null);
        qc.invalidateQueries({ queryKey: getListResourcesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetBridgeSummaryQueryKey() });
        setConfirmId(null);
      },
    });
  };

  return (
    <div>
      <PageHead eyebrow="Library" title="Your saved drafts">{user ? "Drafts made from your lecture materials stay private to your account. Other drafts remain saved for this browser." : "Saved for this browser only. Clearing cookies removes access."} <Link href="/materials" className="text-accent-ink underline" data-testid="link-materials">Manage lecture materials</Link> · <Link href="/admin/reports" className="text-accent-ink underline">Reviewer desk</Link> · <Link href="/review" className="text-accent-ink underline" data-testid="link-review">Earlier reports</Link></PageHead>
      <SavedVisuals />
      {res.isLoading ? <div className="grid gap-3">{[1, 2, 3].map((i) => <Skel key={i} className="h-20" />)}</div>
        : res.isError ? <ErrorState title="Could not load your library" onRetry={() => res.refetch()} />
          : !res.data?.length ? <Empty title="No text drafts yet" action={<Link href="/studio" className={btnAccent}>Open the Studio</Link>}>Text drafts you generate in the Studio land here.</Empty>
            : open ? (
              <ResourceWorkspace resource={open} toolbar={<>
                <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent-ink" data-testid="button-close-resource"><ArrowLeft className="h-4 w-4" aria-hidden /> All drafts</button>
                <button onClick={() => setConfirmId(open.id)} className="inline-flex items-center gap-1.5 text-sm text-destructive" data-testid="button-delete-open"><Trash2 className="h-4 w-4" aria-hidden /> Delete</button>
              </>} />
            ) : (
              <ul className="divide-y border rounded-lg bg-card">
                {res.data.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 p-4">
                    <button onClick={() => setOpenId(r.id)} className="flex-1 text-left min-w-0" data-testid={`button-open-${r.id}`}>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-accent-ink">{r.kind}</span>
                      <span className="block font-display text-lg font-semibold truncate hover:text-accent-ink">{r.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">{r.topic} · {fmtDate(r.createdAt)}</span>
                    </button>
                    <button onClick={() => setConfirmId(r.id)} aria-label={`Delete ${r.title}`} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid={`button-delete-${r.id}`}><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
      <MyReports />
      <AlertDialog open={!!confirmId} onOpenChange={(o) => { if (!o) { setConfirmId(null); del.reset(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed from this browser's library. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {del.isError && <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/5 border border-destructive/30 p-3" data-testid="text-delete-error">Could not confirm deletion: {apiErrorMessage(del.error, "request failed")}. Refresh the Library to check before retrying.</p>}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }} disabled={del.isPending} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete">
              {del.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
