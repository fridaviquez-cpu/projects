import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMaterial, getGetMaterialQueryKey, useDeleteMaterial, getListMaterialsQueryKey,
  getListResourcesQueryKey, getGetBridgeSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorState, Skel } from "@/components/kit";
import { LoginGate, errMsg } from "@/components/materials-kit";

export default function MaterialDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const mat = useGetMaterial(id, { query: { queryKey: [...getGetMaterialQueryKey(id), user?.id ?? "anon"], enabled: isAuthenticated && !!id } });
  const del = useDeleteMaterial();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const scrollToPage = () => {
      if (/^#page-\d+$/.test(window.location.hash)) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    };
    scrollToPage();
    window.addEventListener("hashchange", scrollToPage);
    return () => window.removeEventListener("hashchange", scrollToPage);
  }, [mat.data]);

  const remove = () => del.mutate({ id }, {
    onSuccess: () => {
      qc.removeQueries({ queryKey: getGetMaterialQueryKey(id) });
      qc.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
      qc.invalidateQueries({ queryKey: getListResourcesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetBridgeSummaryQueryKey() });
      nav("/materials");
    },
  });

  return (
    <div>
      <div className="flex justify-between gap-3 mb-5">
        <Link href="/materials" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent" data-testid="link-back-materials"><ArrowLeft className="h-4 w-4" /> All materials</Link>
        {mat.data && <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 text-sm text-destructive" data-testid="button-delete-material"><Trash2 className="h-4 w-4" /> Delete</button>}
      </div>
      {authLoading ? <Skel className="h-40" /> : !isAuthenticated ? <LoginGate />
        : mat.isLoading ? <div className="space-y-3"><Skel className="h-10 w-2/3" />{[1, 2].map((i) => <Skel key={i} className="h-48" />)}</div>
          : mat.isError ? <ErrorState title={errMsg(mat.error, "Could not load this material")} onRetry={() => mat.refetch()} />
            : mat.data ? (
              <div className="rise">
                <p className="font-mono text-xs text-accent">Extracted text · {mat.data.pages.length} pages</p>
                <h1 className="font-display text-3xl font-extrabold mt-1" data-testid="text-material-title">{mat.data.title}</h1>
                <p className="mt-4 text-xs rounded bg-accent/10 p-3 border-l-2 border-accent flex gap-2" data-testid="text-extraction-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" />This is the plain text the Studio will see. Equations, tables, and diagrams can be lost or garbled during extraction. If something important is missing, drafts may be wrong about it.</p>
                {mat.data.pages.length > 1 && (
                  <nav className="mt-5 flex flex-wrap gap-1" aria-label="Pages">
                    {mat.data.pages.map((p) => <a key={p.page} href={`#page-${p.page}`} className="rounded border bg-card px-2 py-0.5 font-mono text-[11px] hover:border-accent" data-testid={`link-page-${p.page}`}>{p.page}</a>)}
                  </nav>
                )}
                <div className="mt-6 space-y-4">
                  {mat.data.pages.map((p) => (
                    <section key={p.page} id={`page-${p.page}`} className="scroll-mt-20 rounded-lg border bg-card" data-testid={`page-${p.page}`}>
                      <header className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">Page {p.page}</header>
                      <pre className="p-4 whitespace-pre-wrap break-words text-sm font-sans leading-relaxed">{p.text.trim() || <span className="italic text-muted-foreground">No text extracted from this page.</span>}</pre>
                    </section>
                  ))}
                </div>
              </div>
            ) : null}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this material?</AlertDialogTitle>
            <AlertDialogDescription>The file and its extracted text are removed. Drafts generated from it are also deleted from your Library. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {del.isError && <p className="text-sm text-destructive">{errMsg(del.error, "Delete failed.")}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }} disabled={del.isPending} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-material">{del.isPending ? "Deleting..." : "Delete material and drafts"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
