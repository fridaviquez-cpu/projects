import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Camera, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useCreateBudgetEntry, useDeleteBudgetEntry, useGetBudgetSummary, useGetWorkspace, useSetBudgetLimit, useUpdateBudgetEntry, type BudgetEntry, type BudgetEntryInputType } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState, ErrorBlock, Field, PageHeader } from "@/components/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { centsToInput, errMsg, money, thisMonth, today, toCents, useRefreshWorkspace } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDraftGuard } from "@/hooks/use-draft-guard";
import { ImageImportDialog } from "@/components/image-import/image-import-dialog";

const shift = (m: string, d: number) => { const [y, mo] = m.split("-").map(Number); const dt = new Date(Date.UTC(y, mo - 1 + d, 1)); return dt.toISOString().slice(0, 7); };
const label = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

function EntryDialog({ open, onOpenChange, entry, month }: { open: boolean; onOpenChange: (o: boolean) => void; entry: BudgetEntry | null; month: string }) {
  const blank = { description: "", category: "", type: "Expense" as BudgetEntryInputType, amount: "", date: `${month}-01`, notes: "" };
  const [f, setF] = useState(blank);
  const [baseline, setBaseline] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateBudgetEntry();
  const update = useUpdateBudgetEntry();
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();
  const pending = create.isPending || update.isPending;
  const guard = useDraftGuard(open && JSON.stringify(f) !== JSON.stringify(baseline), pending, onOpenChange);
  useEffect(() => { if (open) { setError(null); const initial = entry ? { description: entry.description, category: entry.category, type: entry.type, amount: centsToInput(entry.amountCents), date: entry.date, notes: entry.notes } : { ...blank, date: month === thisMonth() ? today() : `${month}-01` }; setF(initial); setBaseline(initial); } }, [open, entry?.id, month]);
  const set = (k: keyof typeof blank) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const amountCents = toCents(f.amount);
    if (!f.description.trim() || !f.category.trim()) return setError("Add a description and category.");
    if (amountCents == null || Number.isNaN(amountCents) || amountCents < 1) return setError("Enter a positive dollar amount with up to 2 decimal places, like 24.99.");
    const data = { description: f.description.trim(), category: f.category.trim(), type: f.type, amountCents, date: f.date, notes: f.notes };
    const cb = { onSuccess: () => { refresh(); onOpenChange(false); toast({ title: entry ? "Entry updated" : "Entry saved", description: `${data.description} · ${label(data.date.slice(0, 7))}` }); }, onError: (err: unknown) => setError(errMsg(err)) };
    if (entry) update.mutate({ id: entry.id, data }, cb); else create.mutate({ data }, cb);
  };
  return (
    <><Dialog open={open} onOpenChange={guard.changeOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-background sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display text-3xl font-normal">{entry ? "Edit entry" : "New entry"}</DialogTitle><DialogDescription>Typed by hand. Have a receipt? Use Scan receipt instead. No bank connections, ever.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <fieldset disabled={pending} className="contents">
          <fieldset className="col-span-2 grid grid-cols-2 rounded-lg bg-secondary p-1">
            <legend className="sr-only">Entry type</legend>
            {(["Expense", "Income"] as const).map((t) => <label key={t} className="relative cursor-pointer"><input type="radio" name="entry-type" value={t} checked={f.type === t} onChange={() => set("type")(t)} className="peer sr-only" data-testid={`button-type-${t}`} /><span className={cn("block rounded-md py-1.5 text-center text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring", f.type === t && "bg-card shadow-sm")}>{t}</span></label>)}
          </fieldset>
          <div className="col-span-2"><Field label="Description" htmlFor="b-desc"><Input id="b-desc" maxLength={160} value={f.description} onChange={(e) => set("description")(e.target.value)} data-testid="input-entry-description" /></Field></div>
          <Field label="Category" htmlFor="b-cat" hint="Choose a suggestion or type your own."><Input id="b-cat" list="budget-categories" maxLength={50} value={f.category} onChange={(e) => set("category")(e.target.value)} placeholder={f.type === "Income" ? "Salary" : "Groceries"} data-testid="input-entry-category" /></Field>
          <datalist id="budget-categories">{(f.type === "Income" ? ["Salary", "Freelance", "Interest", "Other income"] : ["Groceries", "Housing", "Transport", "Utilities", "Health", "Dining", "Shopping", "Other expenses"]).map((category) => <option key={category} value={category} />)}</datalist>
          <Field label="Amount ($)" htmlFor="b-amt"><Input id="b-amt" inputMode="decimal" className="num" value={f.amount} onChange={(e) => set("amount")(e.target.value)} data-testid="input-entry-amount" /></Field>
          <div className="col-span-2"><Field label="Date" htmlFor="b-date" hint={/^\d{4}-\d{2}-\d{2}$/.test(f.date) ? `This entry will appear in ${label(f.date.slice(0, 7))}.` : "The date determines the budget month."}><Input id="b-date" type="date" required value={f.date} onChange={(e) => set("date")(e.target.value)} data-testid="input-entry-date" /></Field></div>
          <div className="col-span-2"><Field label="Notes" htmlFor="b-notes"><Textarea id="b-notes" maxLength={2000} value={f.notes} onChange={(e) => set("notes")(e.target.value)} /></Field></div>
          {error && <p role="alert" className="col-span-2 text-sm text-destructive">{error}</p>}
          <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={() => guard.changeOpen(false)}>Cancel</Button><Button type="submit" disabled={pending} data-testid="button-save-entry">{pending ? "Saving…" : "Save entry"}</Button></DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>{guard.prompt}</>
  );
}

export default function Budget() {
  const [month, setMonth] = useState(thisMonth());
  const ws = useGetWorkspace();
  const sum = useGetBudgetSummary({ month });
  const setLimit = useSetBudgetLimit();
  const del = useDeleteBudgetEntry();
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetEntry | null>(null);
  const [deleting, setDeleting] = useState<BudgetEntry | null>(null);
  const [limitInput, setLimitInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const entries = useMemo(() => (ws.data?.entries ?? []).filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date)), [ws.data, month]);
  const s = sum.data;
  useEffect(() => { setLimitInput(s ? centsToInput(s.limitCents || null) : ""); }, [s?.limitCents, s?.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLimit = (e: FormEvent) => {
    e.preventDefault();
    const c = toCents(limitInput) ?? 0;
    if (Number.isNaN(c)) { toast({ title: "Limit must be a number", variant: "destructive" }); return; }
    setLimit.mutate({ data: { month, limitCents: c } }, { onSuccess: () => { refresh(); toast({ title: c ? `Limit set to ${money(c)}` : "Limit cleared" }); }, onError: (err) => toast({ title: "Couldn't save", description: errMsg(err), variant: "destructive" }) });
  };
  const used = s && s.limitCents > 0 ? Math.min(100, (s.expenseCents / s.limitCents) * 100) : 0;
  const over = s && s.limitCents > 0 && s.expenseCents > s.limitCents;
  const maxCat = Math.max(1, ...(s?.categories.map((c) => c.amountCents) ?? [1]));

  return (
    <div>
      <PageHeader eyebrow="Budget" title="What comes in, what goes out." lede="Steady saving starts with seeing the month clearly. Scan a receipt photo or enter by hand; only what you confirm is stored, privately." action={<div className="flex flex-wrap gap-2"><Button onClick={() => setScanning(true)} data-testid="button-scan-receipt"><Camera className="mr-2 h-4 w-4" />Scan receipt</Button><Button variant="outline" onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-entry"><Plus className="mr-2 h-4 w-4" />Add entry</Button></div>} />
      <div className="mb-6 flex items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month" data-testid="button-prev-month"><ChevronLeft className="h-4 w-4" /></Button>
        <p className="min-w-44 text-center font-display text-2xl" data-testid="text-month">{label(month)}</p>
        <Button size="icon" variant="outline" onClick={() => setMonth(shift(month, 1))} aria-label="Next month" data-testid="button-next-month"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      {sum.isError ? <ErrorBlock message={errMsg(sum.error)} onRetry={() => sum.refetch()} /> : !s ? <Skeleton className="h-40 rounded-2xl bg-secondary" /> : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <section className="paper p-6">
            <dl className="grid grid-cols-3 gap-4">
              <div><dt className="text-xs text-muted-foreground">Income</dt><dd className="num mt-1 text-xl text-chart-2" data-testid="text-income">{money(s.incomeCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Spent</dt><dd className="num mt-1 text-xl" data-testid="text-expense">{money(s.expenseCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Left over</dt><dd className={cn("num mt-1 text-xl", s.balanceCents < 0 && "text-destructive")} data-testid="text-balance">{money(s.balanceCents)}</dd></div>
            </dl>
            <div className="mt-6">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Spending limit</span><span className="num">{s.limitCents ? `${money(s.expenseCents)} of ${money(s.limitCents)}` : "Not set"}</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full transition-transform", over ? "bg-destructive" : "bg-accent")} style={{ width: `${used}%` }} /></div>
              {over && <p className="mt-2 text-xs text-destructive">Over your limit by {money(s.expenseCents - s.limitCents)}. Worth a look, not a judgement.</p>}
              <form onSubmit={saveLimit} className="mt-4 flex gap-2">
                <Input aria-label="Monthly spending limit in dollars" inputMode="decimal" className="num bg-background" placeholder="Limit ($)" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} data-testid="input-limit" />
                <Button type="submit" variant="outline" disabled={setLimit.isPending} data-testid="button-save-limit">Set limit</Button>
              </form>
            </div>
          </section>
          <section className="paper p-6">
            <p className="eyebrow !text-muted-foreground">Spending by category</p>
            {s.categories.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No expenses this month.</p> : (
              <ul className="mt-4 space-y-3">{s.categories.map((c) => (
                <li key={c.category}><div className="flex justify-between text-sm"><span>{c.category}</span><span className="num text-muted-foreground">{money(c.amountCents)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${(c.amountCents / maxCat) * 100}%` }} /></div></li>
              ))}</ul>
            )}
          </section>
        </div>
      )}
      <h2 className="mt-10 mb-4 font-display text-3xl">Entries</h2>
      {entries.length === 0 ? (
        <EmptyState icon={<Wallet className="h-5 w-5" />} title="A blank month" body="Add your paycheck and a few regular costs. Even rough numbers help." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setScanning(true)} data-testid="button-scan-receipt-empty"><Camera className="mr-2 h-4 w-4" />Scan a receipt</Button><Button variant="outline" onClick={() => { setEditing(null); setOpen(true); }}>Add by hand</Button></div>} />
      ) : (
        <ul className="paper divide-y">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3" data-testid={`row-entry-${e.id}`}>
              <span className={cn("h-8 w-1 rounded-full", e.type === "Income" ? "bg-chart-2" : "bg-accent")} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.description}</p><p className="text-xs text-muted-foreground">{e.category} · {e.date}</p></div>
              <span className={cn("num text-sm", e.type === "Income" && "text-chart-2")}>{e.type === "Income" ? "+" : "-"}{money(e.amountCents)}</span>
              <Button size="icon" variant="ghost" aria-label="Edit entry" onClick={() => { setEditing(e); setOpen(true); }} data-testid={`button-edit-entry-${e.id}`}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete entry" onClick={() => setDeleting(e)} data-testid={`button-delete-entry-${e.id}`}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <EntryDialog open={open} onOpenChange={setOpen} entry={editing} month={month} />
      <ImageImportDialog open={scanning} onOpenChange={setScanning} kind="receipt" onSaved={(_r, date) => { if (date) setMonth(date.slice(0, 7)); }} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !del.isPending && setDeleting(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader><AlertDialogTitle className="font-display text-2xl font-normal">Delete this entry?</AlertDialogTitle><AlertDialogDescription>{deleting?.description} ({money(deleting?.amountCents)}) will be permanently removed from {label(month)}. Your monthly totals will update.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={del.isPending} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-entry" onClick={(ev) => { ev.preventDefault(); if (deleting && !del.isPending) del.mutate({ id: deleting.id }, { onSuccess: () => { refresh(); setDeleting(null); toast({ title: "Entry deleted" }); }, onError: (err) => toast({ title: "Couldn't delete", description: errMsg(err), variant: "destructive" }) }); }}>{del.isPending ? "Deleting…" : "Delete entry"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
