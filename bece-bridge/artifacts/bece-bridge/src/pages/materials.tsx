import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Upload, AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListMaterials, getListMaterialsQueryKey, useUploadMaterial, useDeleteMaterial,
  getListResourcesQueryKey, getGetBridgeSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Empty, ErrorState, PageHead, Skel, btnAccent, btnGhost, fmtDate } from "@/components/kit";
import { usePilotCourses, type CourseId, LoginGate, errMsg, useSafeLogout } from "@/components/materials-kit";

const MAX = 5 * 1024 * 1024;

export default function MaterialsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const logout = useSafeLogout();
  const qc = useQueryClient();
  const list = useListMaterials({ query: { queryKey: [...getListMaterialsQueryKey(), user?.id ?? "anon"], enabled: isAuthenticated } });
  const up = useUploadMaterial();
  const del = useDeleteMaterial();
  const { options: COURSES, isError: coursesErr, refetch: refetchCourses } = usePilotCourses();
  const [courseId, setCourseId] = useState<CourseId>("210");
  const [file, setFile] = useState<File | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CourseId | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    up.reset(); setLocalErr(null); setFile(null);
    if (!f) return;
    const ok = f.type === "application/pdf" || f.type === "text/plain" || /\.(pdf|txt)$/i.test(f.name);
    if (!ok) return setLocalErr("Only PDF (with selectable text) or UTF-8 .txt files are supported.");
    if (f.size > MAX) return setLocalErr("That file is larger than 5 MB.");
    setFile(f);
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
    qc.invalidateQueries({ queryKey: getListResourcesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetBridgeSummaryQueryKey() });
  };
  const upload = () => {
    if (!file) return;
    up.mutate({ data: { file, courseId } }, {
      onSuccess: () => { setFile(null); if (inputRef.current) inputRef.current.value = ""; refresh(); },
    });
  };
  const remove = () => {
    if (!confirmId) return;
    del.mutate({ id: confirmId }, { onSuccess: refresh, onSettled: () => setConfirmId(null) });
  };
  const rows = (list.data ?? []).filter((m) => filter === "all" || m.courseId === filter);

  return (
    <div>
      <PageHead eyebrow="Materials" title="Your lecture materials">
        Upload your own course notes or slides so Studio can draft from them. Files are private to your account. Supports PDFs with selectable text or UTF-8 .txt, up to 5 MB and 100 pages.
      </PageHead>
      {authLoading ? <Skel className="h-40" /> : !isAuthenticated ? <LoginGate /> : (
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-8">
          <section className="rounded-lg border bg-card p-5 h-fit">
            <h2 className="font-display text-lg font-semibold">Add a file</h2>
            <label className="block mt-4 text-sm font-medium">Course
              <select value={courseId} onChange={(e) => setCourseId(e.target.value as CourseId)} disabled={up.isPending} className="mt-1 w-full rounded-md border bg-background p-3" data-testid="select-upload-course">
                {COURSES.length ? COURSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>) : <option value={courseId}>ECE {courseId}</option>}
              </select>
            </label>
            <label className="mt-4 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed grid-paper p-6 text-center cursor-pointer hover:border-accent" data-testid="dropzone-upload"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
              <Upload className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium">{file ? file.name : "Choose or drop a PDF or .txt"}</span>
              <span className="text-xs font-mono text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : "max 5 MB · 100 pages"}</span>
              <input ref={inputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} data-testid="input-file" />
            </label>
            <p className="mt-3 text-xs text-muted-foreground flex gap-2"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" />Only text is extracted. Equations, tables, and diagrams can be lost or garbled. Check the page preview after uploading. Scanned PDFs without selectable text will fail.</p>
            {(localErr || up.isError) && <p role="alert" className="mt-3 text-sm text-destructive" data-testid="text-upload-error">{localErr ?? errMsg(up.error, "Upload failed.")}</p>}
            {up.isSuccess && up.data && <p className="mt-3 text-sm" data-testid="text-upload-success">Extracted {up.data.pageCount} page{up.data.pageCount === 1 ? "" : "s"}. <Link href={`/materials/${up.data.id}`} className="text-accent underline">Review the preview</Link></p>}
            <button onClick={upload} disabled={!file || up.isPending} className={`${btnAccent} mt-4 w-full`} data-testid="button-upload">{up.isPending ? "Extracting text..." : "Upload"}</button>
            <button onClick={logout} className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent" data-testid="button-logout"><LogOut className="h-3.5 w-3.5" /> Log out</button>
          </section>
          <section>
            <div className="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label="Filter by course">
              {coursesErr && <button onClick={() => refetchCourses()} className="text-xs text-destructive underline" data-testid="button-retry-courses">Course list failed. Retry</button>}
              {(["all", ...COURSES.map((c) => c.id)] as (CourseId | "all")[]).map((f) => (
                <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
                  className={`rounded-full border px-3 py-1 text-xs font-mono ${filter === f ? "border-accent bg-accent/10" : "bg-card hover:border-foreground/30"}`}>{f === "all" ? "All" : `ECE ${f}`}</button>
              ))}
            </div>
            {list.isLoading ? <div className="grid gap-3">{[1, 2, 3].map((i) => <Skel key={i} className="h-16" />)}</div>
              : list.isError ? <ErrorState title={errMsg(list.error, "Could not load your materials")} onRetry={() => list.refetch()} />
                : !rows.length ? <Empty title="No materials yet">Upload a lecture PDF or notes file to use it in the Studio.</Empty>
                  : (
                    <ul className="divide-y border rounded-lg bg-card">
                      {rows.map((m) => (
                        <li key={m.id} className="flex items-center gap-3 p-4" data-testid={`row-material-${m.id}`}>
                          <FileText className="h-4 w-4 text-accent shrink-0" />
                          <Link href={`/materials/${m.id}`} className="flex-1 min-w-0" data-testid={`link-material-${m.id}`}>
                            <span className="block font-display font-semibold truncate hover:text-accent">{m.title}</span>
                            <span className="block text-xs font-mono text-muted-foreground">ECE {m.courseId} · {m.pageCount} pages · {fmtDate(m.createdAt)}</span>
                          </Link>
                          <button onClick={() => setConfirmId(m.id)} aria-label={`Delete ${m.title}`} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid={`button-delete-material-${m.id}`}><Trash2 className="h-4 w-4" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
            <Link href="/studio" className={`${btnGhost} mt-5`} data-testid="link-studio">Draft from materials in Studio</Link>
          </section>
        </div>
      )}
      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this material?</AlertDialogTitle>
            <AlertDialogDescription>The file and its extracted text are removed. Drafts generated from it are also deleted from your Library. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {del.isError && <p className="text-sm text-destructive">{errMsg(del.error, "Delete failed.")}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-material">Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }} disabled={del.isPending} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-material">{del.isPending ? "Deleting..." : "Delete material and drafts"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
