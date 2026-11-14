import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function useDraftNavigationWarning(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onLink = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onLink, true); };
  }, [dirty, message]);
}

/** Protect a draft on Escape, outside click, Cancel, close, and browser exit. */
export function useDraftGuard(dirty: boolean, pending: boolean, onOpenChange: (open: boolean) => void) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  const changeOpen = (open: boolean) => {
    if (pending) return;
    if (!open && dirty) setConfirm(true);
    else onOpenChange(open);
  };
  const prompt = (
    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent className="bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Your changes have not been saved. Keep editing to finish, or discard this draft. Previously saved records will not change.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-keep-editing">Keep editing</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground" data-testid="button-discard-draft" onClick={() => { setConfirm(false); onOpenChange(false); }}>Discard changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { changeOpen, prompt };
}
