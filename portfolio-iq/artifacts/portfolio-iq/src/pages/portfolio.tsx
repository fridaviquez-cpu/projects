import { useMemo, useState } from "react";
import { ImageUp, FileUp, BookText, Pencil, Plus, Search, Trash2, Layers } from "lucide-react";
import { useDeleteHolding, useGetWorkspace, type Holding } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState, PageHeader, SampleTag } from "@/components/kit";
import { HoldingDialog } from "@/components/holding-dialog";
import { ImageImportDialog } from "@/components/image-import/image-import-dialog";
import { ImportCsvDialog } from "@/components/import-csv-dialog";
import { useToast } from "@/hooks/use-toast";
import { errMsg, money, TYPE_COLORS, useRefreshWorkspace } from "@/lib/money";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/hooks/use-personalization";
import { glossaryFor } from "@/lib/personalize";

const TYPES = ["All", "ETF", "Stock", "Bond", "Cash", "Crypto", "Other"];

export default function Portfolio() {
  const ws = useGetWorkspace();
  const del = useDeleteHolding();
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [editing, setEditing] = useState<Holding | null>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<Holding | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const { prefs } = usePrefs();
  const glossary = glossaryFor(prefs);
  const holdings = useMemo(() => ws.data?.holdings ?? [], [ws.data]);
  const total = holdings.reduce((s, h) => s + Math.round(h.quantity * h.priceCents), 0);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return holdings
      .filter((h) => (type === "All" || h.type === type) && (!s || h.symbol.toLowerCase().includes(s) || h.name.toLowerCase().includes(s)))
      .sort((a, b) => b.quantity * b.priceCents - a.quantity * a.priceCents);
  }, [holdings, q, type]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const confirmDelete = () => {
    if (!deleting || del.isPending) return;
    const sym = deleting.symbol;
    del.mutate({ id: deleting.id }, {
      onSuccess: () => { refresh(); toast({ title: `${sym} removed` }); setDeleting(null); },
      onError: (e) => toast({ title: "Couldn't delete", description: errMsg(e), variant: "destructive" }),
    });
  };

  return (
    <div>
      <PageHeader eyebrow="Holdings" title="What you own, written down." lede="Import a brokerage screenshot, import a CSV, or type a line by hand. Prices are snapshots; total paid is optional and never guessed." action={<div className="flex flex-wrap gap-2"><Button onClick={() => setImporting(true)} data-testid="button-import-screenshot"><ImageUp className="mr-2 h-4 w-4" />Import screenshot</Button><Button variant="outline" onClick={() => setImportingCsv(true)} data-testid="button-import-csv"><FileUp className="mr-2 h-4 w-4" />Import CSV</Button><Button variant="outline" onClick={openNew} data-testid="button-add-holding"><Plus className="mr-2 h-4 w-4" />Add by hand</Button></div>} />
      {holdings.length === 0 ? (
        <EmptyState icon={<Layers className="h-5 w-5" />} title="No holdings yet" body="Import a screenshot of your brokerage positions and review what we read, or add one line by hand." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setImporting(true)} data-testid="button-import-screenshot-empty"><ImageUp className="mr-2 h-4 w-4" />Import screenshot</Button><Button variant="outline" onClick={openNew} data-testid="button-add-holding-empty">Add by hand</Button></div>} />
      ) : (
        <>
          <div className="rise mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or name" className="bg-card pl-9" aria-label="Search holdings" data-testid="input-search-holdings" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
              {TYPES.map((t) => (
                <button key={t} onClick={() => setType(t)} aria-pressed={type === t} data-testid={`button-filter-${t}`}
                  className={cn("rounded-full border px-3 py-1 text-xs transition-colors", type === t ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/40")}>{t}</button>
              ))}
            </div>
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<Search className="h-5 w-5" />} title="No matches" body="Nothing fits that search and filter." action={<Button variant="outline" onClick={() => { setQ(""); setType("All"); }}>Clear filters</Button>} />
          ) : (
            <ul className="space-y-3">
              {list.map((h) => {
                const value = Math.round(h.quantity * h.priceCents);
                const gain = h.costBasisCents == null ? null : value - h.costBasisCents;
                return (
                  <li key={h.id} className="paper group grid grid-cols-[auto_1fr] gap-4 p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center" data-testid={`card-holding-${h.id}`}>
                    <span title={h.symbol} className="num grid min-h-11 w-14 place-items-center break-all rounded-lg px-1 py-2 text-center text-[10px] font-medium leading-tight text-white" style={{ background: TYPE_COLORS[h.type] }}>{h.symbol}</span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium"><span className="truncate">{h.name}</span>{h.isSample && <SampleTag />}</p>
                      <p className="num mt-0.5 text-xs text-muted-foreground">{h.quantity} x {money(h.priceCents)} · {h.type} · as of {h.priceDate}</p>
                      {h.notes && <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">{h.notes}</p>}
                    </div>
                    <div className="col-span-2 flex items-baseline justify-between sm:col-span-1 sm:block sm:text-right">
                      <p className="num" data-testid={`text-holding-value-${h.id}`}>{money(value)}</p>
                      <p className={cn("num text-xs", gain == null ? "text-muted-foreground" : gain >= 0 ? "text-chart-2" : "text-destructive")}>
                        {gain == null ? "Cost unknown" : `${gain >= 0 ? "+" : ""}${money(gain)}`}{total > 0 && <span className="text-muted-foreground"> · {((value / total) * 100).toFixed(1)}%</span>}
                      </p>
                    </div>
                    <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(h); setOpen(true); }} aria-label={`Edit ${h.symbol}`} data-testid={`button-edit-holding-${h.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(h)} aria-label={`Delete ${h.symbol}`} data-testid={`button-delete-holding-${h.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <details className="paper mt-10 p-5" data-testid="section-brokerage-glossary">
        <summary className="flex cursor-pointer items-center gap-2 font-medium"><BookText className="h-4 w-4 text-accent" />Terms your platform shows{prefs?.brokerages.some((b) => b !== "None" && b !== "Other") ? `: ${glossary.map((g) => g.brokerage).join(", ")}` : ""}</summary>
        <p className="mt-2 text-xs text-muted-foreground">Educational notes only, chosen from your setup answers. PortfolioIQ never connects to or reads a brokerage account.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {glossary.map((g) => (
            <div key={g.brokerage} data-testid={`glossary-${g.brokerage.replace(/\s/g, "-")}`}>
              <p className="eyebrow mb-2">{g.brokerage}</p>
              <dl className="space-y-2.5 text-sm">{g.entries.map((e) => <div key={e.term}><dt className="font-medium">{e.term}</dt><dd className="text-muted-foreground">{e.meaning}</dd></div>)}</dl>
            </div>
          ))}
        </div>
      </details>
      <ImportCsvDialog open={importingCsv} onOpenChange={setImportingCsv} existing={holdings} />
      <HoldingDialog open={open} onOpenChange={setOpen} holding={editing} />
      <ImageImportDialog open={importing} onOpenChange={setImporting} kind="holdings" />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !del.isPending && setDeleting(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Remove {deleting?.symbol}?</AlertDialogTitle>
            <AlertDialogDescription>This deletes the record from your workspace. It doesn't affect anything at your broker.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={del.isPending} onClick={(e) => { e.preventDefault(); confirmDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">{del.isPending ? "Removing..." : "Remove holding"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
