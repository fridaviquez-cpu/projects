import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, FileUp, RotateCcw } from "lucide-react";
import { useImportHoldings, type HoldingsImportInput, type Holding } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDraftGuard } from "@/hooks/use-draft-guard";
import { errMsg, money, today, useRefreshWorkspace } from "@/lib/money";
import { aggregateError, autoMap, buildRows, FIELDS, MAX_FILE_BYTES, MAX_ROWS, parseCsv, TEMPLATE, type FieldKey, type Mapping } from "@/lib/csv-import";
import { cn } from "@/lib/utils";

type Behavior = HoldingsImportInput["duplicateBehavior"];
type Parsed = { fileName: string; headers: string[]; rows: string[][] };
const selectCls = "h-9 min-w-0 w-full rounded-md border bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function ImportCsvDialog({ open, onOpenChange, existing }: { open: boolean; onOpenChange: (o: boolean) => void; existing: Holding[] }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [defaultDate, setDefaultDate] = useState(today());
  const [behavior, setBehavior] = useState<Behavior>("skip");
  const [sent, setSent] = useState<HoldingsImportInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imp = useImportHoldings({ mutation: { retry: false } });
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();
  const frozen = sent !== null;

  const reset = () => { setParsed(null); setFileError(null); setMapping(null); setDefaultDate(today()); setBehavior("skip"); setSent(null); setError(null); imp.reset(); if (fileRef.current) fileRef.current.value = ""; };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };
  const guard = useDraftGuard(open && (parsed !== null || frozen), imp.isPending, close);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setParsed(null); setMapping(null); setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setFileError(`That file is ${(file.size / 1024).toFixed(0)} KB. The limit is ${MAX_FILE_BYTES / 1024} KB.`);
    try {
      const all = parseCsv(await file.text());
      const [headers, ...rows] = all;
      if (!rows.length) return setFileError("The file has a header but no data rows.");
      if (rows.length > MAX_ROWS) return setFileError(`The file has ${rows.length} data rows. Import at most ${MAX_ROWS} at a time; split the file and import in parts.`);
      setParsed({ fileName: file.name, headers, rows });
      setMapping(autoMap(headers));
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "We couldn't read that file.");
    }
  };

  const review = useMemo(() => (parsed && mapping ? buildRows(parsed.rows, mapping, defaultDate, existing) : []), [parsed, mapping, defaultDate, existing]);
  const missing = mapping ? FIELDS.filter((f) => f.key !== "date" && f.required && mapping[f.key] == null) : [];
  const invalid = review.filter((r) => r.errors.length).length;
  const dups = review.filter((r) => r.dup).length;
  const willImport = behavior === "add" ? review.length : review.length - dups;
  const willSkip = behavior === "skip" ? dups : 0;
  const aggErr = invalid === 0 && review.length ? aggregateError(behavior === "skip" ? review.filter((r) => !r.dup) : review, existing) : null;
  const blocked = !!aggErr || !parsed || missing.length > 0 || invalid > 0 || (behavior === "reject" && dups > 0) || willImport === 0;

  const setCol = (k: FieldKey, v: string) => setMapping((m) => {
    if (!m) return m;
    const idx = v === "" ? null : Number(v);
    const next = { ...m };
    if (idx != null) (Object.keys(next) as FieldKey[]).forEach((key) => { if (next[key] === idx) next[key] = null; });
    next[k] = idx;
    return next;
  });

  const send = (payload: HoldingsImportInput) => {
    setError(null); setSent(payload);
    imp.mutate({ data: payload }, {
      onSuccess: (r) => {
        refresh();
        toast({ title: `Imported ${r.imported} holding${r.imported === 1 ? "" : "s"}`, description: r.skipped ? `${r.skipped} duplicate${r.skipped === 1 ? "" : "s"} skipped.` : "Nothing was replaced." });
        close(false);
      },
      onError: (e) => setError(errMsg(e)),
    });
  };
  const submit = () => {
    if (imp.isPending || frozen || blocked) return;
    send({ importId: crypto.randomUUID(), duplicateBehavior: behavior, holdings: review.map((r) => r.holding!) });
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "portfolioiq-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <><Dialog open={open} onOpenChange={guard.changeOpen}>
      <DialogContent className="max-h-[92dvh] min-w-0 grid-cols-[minmax(0,1fr)] overflow-y-auto bg-background sm:max-w-4xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="font-display text-3xl font-normal">Import from a spreadsheet</DialogTitle>
          <DialogDescription>Your file is read in this browser and never uploaded. Only the reviewed rows are saved. Existing holdings are never replaced.</DialogDescription>
        </DialogHeader>

        {!parsed && (
          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>One row per holding, with a header row.</li>
                <li>Prices in USD per unit, up to 2 decimals. Total cost is for all units; leave blank if unknown.</li>
                <li>Type is one of ETF, Stock, Bond, Cash, Crypto, Other. Dates as YYYY-MM-DD.</li>
                <li>Up to {MAX_ROWS} rows and {MAX_FILE_BYTES / 1024} KB per file.</li>
              </ol>
              <label htmlFor="csv-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-card p-6 text-center transition-colors hover:border-primary">
                <FileUp className="h-6 w-6 text-primary" />
                <span className="font-medium">Choose a .csv file</span>
                <span className="text-xs text-muted-foreground">Export from your broker or spreadsheet app</span>
              </label>
              <input id="csv-file" ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} data-testid="input-csv-file" />
              {fileError && <p role="alert" className="text-sm text-destructive" data-testid="text-csv-file-error">{fileError}</p>}
            </div>
            <div className="paper min-w-0 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Example</p>
                <Button size="sm" variant="ghost" onClick={downloadTemplate} data-testid="button-download-template"><Download className="mr-1.5 h-3.5 w-3.5" />Template</Button>
              </div>
              <pre className="num overflow-x-auto whitespace-pre text-[11px] leading-relaxed">{TEMPLATE}</pre>
            </div>
          </div>
        )}

        {parsed && mapping && (
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="min-w-0 break-all"><span className="font-medium">{parsed.fileName}</span> <span className="text-muted-foreground">· {parsed.rows.length} rows</span></p>
              {!frozen && <Button size="sm" variant="outline" onClick={reset} data-testid="button-choose-another"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Choose another file</Button>}
            </div>

            <fieldset disabled={frozen} className="min-w-0 space-y-2">
              <legend className="mb-2 text-sm font-medium">Match your columns</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FIELDS.map((f) => (
                  <div key={f.key} className="min-w-0 space-y-1">
                    <label htmlFor={`map-${f.key}`} className="text-xs font-medium">{f.label}{f.required ? "" : f.key === "cost" ? " (optional)" : " (or default)"}</label>
                    <select id={`map-${f.key}`} className={cn(selectCls, f.required && mapping[f.key] == null && "border-destructive")} value={mapping[f.key] ?? ""} onChange={(e) => setCol(f.key, e.target.value)} data-testid={`select-map-${f.key}`}>
                      <option value="">{f.key === "cost" ? "Not in file (unknown)" : f.key === "date" ? "Use default date" : "Choose a column"}</option>
                      {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
                {mapping.date == null && (
                  <div className="space-y-1">
                    <label htmlFor="default-date" className="text-xs font-medium">Default snapshot date</label>
                    <Input id="default-date" type="date" value={defaultDate} onChange={(e) => setDefaultDate(e.target.value)} className="h-9" data-testid="input-default-date" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Each column can be used once; picking it again moves it.</p>
              {missing.length > 0 && <p role="alert" className="text-sm text-destructive">Choose columns for: {missing.map((f) => f.label).join(", ")}.</p>}
            </fieldset>

            <fieldset disabled={frozen} className="min-w-0">
              <legend className="mb-2 text-sm font-medium">If a symbol and type are already in your holdings or earlier in the file</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {([["skip", "Skip duplicates"], ["add", "Add as separate holdings"], ["reject", "Stop if any duplicates"]] as [Behavior, string][]).map(([v, l]) => (
                  <label key={v} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm", behavior === v ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                    <input type="radio" name="dup" value={v} checked={behavior === v} onChange={() => setBehavior(v)} className="sr-only" data-testid={`radio-duplicates-${v}`} />{l}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Sample holdings are ignored and left untouched. Nothing is ever overwritten.</p>
            </fieldset>

            <div className="w-full min-w-0 overflow-x-auto rounded-xl border bg-card" role="region" aria-label="Review imported holdings" tabIndex={0}>
              <table className="w-full text-left text-xs">
                <thead className="border-b text-muted-foreground"><tr>{["Row", "Symbol", "Name", "Type", "Qty", "Price", "Total cost", "Date", "Status"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {review.map((r) => (
                    <tr key={r.line} className={cn("border-b last:border-0 align-top", r.errors.length ? "bg-destructive/5" : r.dup && "bg-secondary/60")} data-testid={`row-import-${r.line}`}>
                      <td className="num px-2 py-1.5 text-muted-foreground">{r.line}</td>
                      <td className="num px-2 py-1.5 font-medium">{r.values.symbol.toUpperCase()}</td>
                      <td className="max-w-[12rem] truncate px-2 py-1.5">{r.values.name}</td>
                      <td className="px-2 py-1.5">{r.values.type}</td>
                      <td className="num px-2 py-1.5">{r.values.quantity}</td>
                      <td className="num px-2 py-1.5">{r.holding ? money(r.holding.priceCents) : r.values.price}</td>
                      <td className="num px-2 py-1.5">{r.holding ? (r.holding.costBasisCents == null ? <span className="italic text-muted-foreground">Unknown</span> : money(r.holding.costBasisCents)) : r.values.cost || <span className="italic text-muted-foreground">Unknown</span>}</td>
                      <td className="num px-2 py-1.5">{r.values.date}</td>
                      <td className="px-2 py-1.5" data-testid={`status-import-${r.line}`}>
                        {r.errors.length ? <ul className="space-y-0.5 text-destructive">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                          : r.dup ? <span className="text-foreground">{r.dup === "existing" ? "Already in holdings" : "Repeats an earlier row"} · {behavior === "skip" ? "will skip" : behavior === "add" ? "added separately" : "blocks import"}</span>
                          : <span className="text-chart-2">Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="rounded-lg bg-secondary px-3 py-2 text-sm" role="status" data-testid="text-import-summary">
              {invalid > 0 ? <><strong>{invalid}</strong> row{invalid === 1 ? "" : "s"} need fixing in your file before importing.</>
                : behavior === "reject" && dups > 0 ? <><strong>{dups}</strong> duplicate{dups === 1 ? "" : "s"} found. Choose skip or add, or remove them from the file.</>
                : <>Will import <strong className="num">{willImport}</strong>{willSkip > 0 && <>, skip <strong className="num">{willSkip}</strong></>}. New rows are your own records, not samples.</>}
            </p>
            {aggErr && <p role="alert" className="text-sm text-destructive" data-testid="text-import-aggregate-error">{aggErr}</p>}
            {error && (
              <p role="alert" className="text-sm text-destructive" data-testid="text-import-error">
                {error} The import may have been saved anyway. Retry sends the exact same batch, so it can't be added twice.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" disabled={imp.isPending} onClick={() => guard.changeOpen(false)} data-testid="button-cancel-import">Cancel</Button>
          {frozen && !imp.isPending ? (
            <Button onClick={() => send(sent!)} data-testid="button-retry-import"><RotateCcw className="mr-2 h-4 w-4" />Retry same batch</Button>
          ) : (
            <Button onClick={submit} disabled={blocked || imp.isPending} data-testid="button-confirm-import">{imp.isPending ? "Importing..." : parsed && !blocked ? `Import ${willImport} holding${willImport === 1 ? "" : "s"}` : "Import"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>{guard.prompt}</>
  );
}
