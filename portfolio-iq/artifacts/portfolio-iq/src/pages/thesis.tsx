import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Lightbulb, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useCreateThesis, useDeleteThesis, useGetWorkspace, useUpdateThesis, ThesisInputStatus, type Thesis, type ThesisInputStatus as TS } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState, Field, PageHeader } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { errMsg, useRefreshWorkspace } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDraftGuard } from "@/hooks/use-draft-guard";
import { usePrefs } from "@/hooks/use-personalization";
import { thesisPrompts } from "@/lib/personalize";

const STATUS_DOT: Record<string, string> = { Researching: "bg-chart-4", Invested: "bg-chart-2", Reviewing: "bg-accent", Archived: "bg-muted-foreground" };
const blank = { symbol: "", title: "", reasoning: "", risks: "", status: "Researching" as TS };

type Template = { title: string; reasoning: string };
function ThesisDialog({ open, onOpenChange, thesis, template = null }: { open: boolean; onOpenChange: (o: boolean) => void; thesis: Thesis | null; template?: Template | null }) {
  const [f, setF] = useState(blank);
  const [baseline, setBaseline] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateThesis();
  const update = useUpdateThesis();
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();
  useEffect(() => { if (open) { setError(null); const initial = thesis ? { symbol: thesis.symbol, title: thesis.title, reasoning: thesis.reasoning, risks: thesis.risks, status: thesis.status } : template ? { ...blank, title: template.title, reasoning: template.reasoning } : blank; setF(initial); setBaseline(thesis ? initial : blank); } }, [open, thesis?.id, template]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = create.isPending || update.isPending;
  const guard = useDraftGuard(open && JSON.stringify(f) !== JSON.stringify(baseline), pending, onOpenChange);
  const set = (k: keyof typeof blank) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!f.title.trim()) return setError("Give your thesis a one-line title.");
    const data = { ...f, symbol: f.symbol.trim().toUpperCase(), title: f.title.trim() };
    const cb = { onSuccess: () => { refresh(); toast({ title: thesis ? "Thesis updated" : "Thesis saved" }); onOpenChange(false); }, onError: (err: unknown) => setError(errMsg(err)) };
    if (thesis) update.mutate({ id: thesis.id, data }, cb); else create.mutate({ data }, cb);
  };
  return (
    <><Dialog open={open} onOpenChange={guard.changeOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-background sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">{thesis ? "Revisit thesis" : "Write a thesis"}</DialogTitle>
          <DialogDescription>Why this, why now, and what would change your mind.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <fieldset disabled={pending} className="contents">
          <Field label="Symbol (optional)" htmlFor="t-sym"><Input id="t-sym" maxLength={16} value={f.symbol} onChange={(e) => set("symbol")(e.target.value)} className="num uppercase" data-testid="input-thesis-symbol" /></Field>
          <Field label="Status" htmlFor="t-status">
            <Select value={f.status} onValueChange={set("status")}><SelectTrigger id="t-status" data-testid="select-thesis-status"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.values(ThesisInputStatus).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </Field>
          <div className="col-span-2"><Field label="Title" htmlFor="t-title"><Input id="t-title" maxLength={160} value={f.title} onChange={(e) => set("title")(e.target.value)} placeholder="Own the market, not the headlines" data-testid="input-thesis-title" /></Field></div>
          <div className="col-span-2"><Field label="Reasoning" htmlFor="t-reason"><Textarea id="t-reason" rows={5} maxLength={8000} value={f.reasoning} onChange={(e) => set("reasoning")(e.target.value)} placeholder="What do you believe, and why?" data-testid="input-thesis-reasoning" /></Field></div>
          <div className="col-span-2"><Field label="Risks" htmlFor="t-risks" hint="What would prove you wrong?"><Textarea id="t-risks" rows={3} maxLength={4000} value={f.risks} onChange={(e) => set("risks")(e.target.value)} data-testid="input-thesis-risks" /></Field></div>
          {error && <p role="alert" className="col-span-2 text-sm text-destructive">{error}</p>}
          <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={() => guard.changeOpen(false)}>Cancel</Button><Button type="submit" disabled={pending} data-testid="button-save-thesis">{pending ? "Saving..." : "Save thesis"}</Button></DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>{guard.prompt}</>
  );
}

export default function ThesisPage() {
  const ws = useGetWorkspace();
  const del = useDeleteThesis();
  const update = useUpdateThesis();
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("All");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Thesis | null>(null);
  const [deleting, setDeleting] = useState<Thesis | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const { prefs } = usePrefs();
  const prompts = thesisPrompts(prefs);
  const theses = useMemo(() => ws.data?.theses ?? [], [ws.data]);
  const list = useMemo(() => theses.filter((t) => filter === "All" || t.status === filter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [theses, filter]);
  const count = (s: string) => theses.filter((t) => t.status === s).length;

  const setStatus = (t: Thesis, status: TS) => update.mutate({ id: t.id, data: { symbol: t.symbol, title: t.title, reasoning: t.reasoning, risks: t.risks, status } }, { onSuccess: () => refresh(), onError: (e) => toast({ title: "Couldn't update", description: errMsg(e), variant: "destructive" }) });

  return (
    <div>
      <PageHeader eyebrow="Thesis journal" title="Think before you trade." lede="A thesis is your reason for an investment: what you believe, what could go wrong, and what would change your mind." action={<Button onClick={() => { setEditing(null); setTemplate(null); setOpen(true); }} data-testid="button-new-thesis"><Plus className="mr-2 h-4 w-4" />New thesis</Button>} />
      <section className="rise mb-8" aria-labelledby="prompts-h" data-testid="section-thesis-prompts">
        <p id="prompts-h" className="eyebrow mb-2 flex items-center gap-1.5 !text-muted-foreground"><Lightbulb className="h-3.5 w-3.5 text-accent" />{prefs ? "Prompts from your setup answers" : "A prompt to start from"}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {prompts.map((p, i) => (
            <button key={p.title} type="button" onClick={() => { setEditing(null); setTemplate(p); setOpen(true); }} className="rounded-xl border border-dashed border-input bg-card/60 p-4 text-left transition-colors hover:border-accent" data-testid={`button-thesis-template-${i}`}>
              <span className="block font-medium">{p.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{p.reasoning}</span>
              <span className="mt-2 block text-xs text-accent">Start a new draft with this prompt</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Opens a new, unsaved draft. Nothing is saved until you press Save, and existing entries are never changed.</p>
      </section>
      <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {["All", ...Object.values(ThesisInputStatus)].map((s) => (
          <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} data-testid={`button-status-${s}`} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", filter === s ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
            {s !== "All" && <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} />}{s}<span className="num opacity-60">{s === "All" ? theses.length : count(s)}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<NotebookPen className="h-5 w-5" />} title={theses.length ? `Nothing ${filter.toLowerCase()}` : "Your journal is empty"} body={theses.length ? "Try a different status." : "Before your next buy, write two sentences: why this, and what would make you sell."} action={!theses.length && <Button onClick={() => { setEditing(null); setTemplate(null); setOpen(true); }}>Write your first thesis</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((t) => (
            <article key={t.id} className="paper flex flex-col p-5" data-testid={`card-thesis-${t.id}`}>
              <div className="flex items-center gap-2 text-xs">
                {t.symbol && <span className="num rounded bg-secondary px-1.5 py-0.5">{t.symbol}</span>}
                <Select value={t.status} onValueChange={(v) => setStatus(t, v as TS)}>
                  <SelectTrigger className="h-7 w-auto gap-2 border-none bg-transparent px-2 text-xs shadow-none" aria-label="Change status" data-testid={`select-status-${t.id}`}><span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[t.status])} /><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.values(ThesisInputStatus).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <span className="ml-auto text-muted-foreground">{new Date(t.updatedAt).toLocaleDateString()}</span>
              </div>
              <h3 className="mt-3 font-display text-2xl leading-tight">{t.title}</h3>
              {t.reasoning && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{t.reasoning}</p>}
              {t.risks && <p className="mt-3 border-l-2 border-accent pl-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Risks: </span>{t.risks}</p>}
              <div className="mt-auto flex justify-end gap-1 pt-4">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setTemplate(null); setOpen(true); }} data-testid={`button-edit-thesis-${t.id}`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(t)} data-testid={`button-delete-thesis-${t.id}`}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ThesisDialog open={open} onOpenChange={setOpen} thesis={editing} template={editing ? null : template} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !del.isPending && setDeleting(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader><AlertDialogTitle className="font-display text-2xl font-normal">Delete “{deleting?.title}”?</AlertDialogTitle><AlertDialogDescription>This permanently deletes this journal entry. To keep its history, cancel and change its status to Archived instead.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={del.isPending} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-thesis" onClick={(e) => { e.preventDefault(); if (deleting && !del.isPending) del.mutate({ id: deleting.id }, { onSuccess: () => { refresh(); setDeleting(null); toast({ title: "Thesis deleted" }); }, onError: (err) => toast({ title: "Couldn't delete", description: errMsg(err), variant: "destructive" }) }); }}>{del.isPending ? "Deleting…" : "Delete thesis"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
