import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ScanText } from "lucide-react";
import { useConfirmImageImport, useExtractImageImport, useGetWorkspace, type ImageImportConfirmation, type ImageImportResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDraftGuard } from "@/hooks/use-draft-guard";
import { useToast } from "@/hooks/use-toast";
import { errMsg, useRefreshWorkspace } from "@/lib/money";
import { checkImageFile, holdingProblems, newRequestId, prepareImage, receiptProblems, toEntryInput, toHoldingInput, toHoldingRow, toReceiptForm, type HoldingRow, type ReceiptForm } from "@/lib/image-import";
import { Disclosure, ImagePicker } from "./image-picker";
import { HoldingsReview } from "./holdings-review";
import { ReceiptReview } from "./receipt-review";

type Kind = "holdings" | "receipt";
type Props = { open: boolean; onOpenChange: (o: boolean) => void; kind: Kind; onSaved?: (result: ImageImportResult, receiptDate: string | null) => void };

export function ImageImportDialog({ open, onOpenChange, kind, onSaved }: Props) {
  const extract = useExtractImageImport({ mutation: { gcTime: 0 } });
  const confirm = useConfirmImageImport();
  const refresh = useRefreshWorkspace();
  const ws = useGetWorkspace();
  const { toast } = useToast();
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<HoldingRow[] | null>(null);
  const [receipt, setReceipt] = useState<ReceiptForm | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [allowDup, setAllowDup] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageImportResult | null>(null);
  const [finishing, setFinishing] = useState(false);
  const gen = useRef(0);
  const attempt = useRef<{ id: string; payload: string | null }>({ id: newRequestId(), payload: null });
  const urlRef = useRef<string | null>(null);

  const existingSymbols = useMemo(() => new Set((ws.data?.holdings ?? []).map((h) => h.symbol.toUpperCase())), [ws.data]);
  const hasDraft = !result && (!!file || !!rows || !!receipt);
  const saving = confirm.isPending || finishing;

  const resetAll = () => {
    gen.current++;
    extract.reset();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setFile(null); setFileError(null); setReading(false); setRows(null); setReceipt(null); setWarnings([]); setAllowDup(false); setSaveError(null); setResult(null);
    attempt.current = { id: newRequestId(), payload: null };
  };
  useEffect(() => { if (!open) resetAll(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const guard = useDraftGuard(open && hasDraft, saving, onOpenChange);

  const chooseFile = (f: File) => {
    const problem = checkImageFile(f);
    if (problem) { setFileError(problem); return; }
    if ((rows || receipt) && !window.confirm("Replacing the image will discard these unsaved extracted details. Continue?")) return;
    resetAll();
    const url = URL.createObjectURL(f);
    urlRef.current = url;
    setFile({ url, name: f.name });
  };
  const clearImage = () => {
    if ((rows || receipt) && !window.confirm("Remove this image and discard its unsaved extracted details?")) return;
    resetAll();
  };

  const read = async () => {
    if (!file || reading) return;
    const my = ++gen.current;
    setReading(true); setFileError(null); setSaveError(null);
    try {
      const imageDataUrl = await prepareImage(file.url);
      if (my !== gen.current) return;
      const draft = await extract.mutateAsync({ data: { kind, imageDataUrl } });
      if (my !== gen.current) return;
      attempt.current = { id: newRequestId(), payload: null };
      setWarnings(draft.warnings ?? []);
      if (kind === "holdings") {
        const r = draft.holdings.map(toHoldingRow).map((row) => ({
          ...row, selected: !existingSymbols.has(row.symbol.toUpperCase()),
        }));
        if (!r.length) setFileError("No holdings were found in this image. Try a sharper screenshot that shows symbols and quantities.");
        else setRows(r);
      } else setReceipt(toReceiptForm(draft.receipt));
    } catch (e) {
      if (my === gen.current) setFileError(errMsg(e));
    } finally {
      if (my === gen.current) setReading(false);
    }
  };
  const stopReading = () => { gen.current++; setReading(false); };

  const selected = rows?.filter((r) => r.selected) ?? [];
  const newHoldingCount = allowDup ? selected.length : new Set(selected.filter((r) => !existingSymbols.has(r.symbol.trim().toUpperCase())).map((r) => r.symbol.trim().toUpperCase())).size;
  const blocking = kind === "holdings" ? selected.filter((r) => Object.keys(holdingProblems(r)).length > 0).length : receipt ? Object.keys(receiptProblems(receipt)).length : 1;
  const canSave = !saving && (kind === "holdings" ? newHoldingCount > 0 : !!receipt) && blocking === 0;

  const save = async () => {
    if (!canSave) return;
    const body: Omit<ImageImportConfirmation, "requestId"> = kind === "holdings"
      ? { kind, allowDuplicates: allowDup, holdings: selected.map(toHoldingInput), entries: [] }
      : { kind, allowDuplicates: allowDup, holdings: [], entries: [toEntryInput(receipt!)] };
    const payload = JSON.stringify(body);
    if (attempt.current.payload !== null && attempt.current.payload !== payload) attempt.current = { id: newRequestId(), payload: null };
    attempt.current.payload = payload;
    setSaveError(null); setFinishing(true);
    try {
      const res = await confirm.mutateAsync({ data: { ...body, requestId: attempt.current.id } });
      await refresh();
      setResult(res);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null; setFile(null);
      const date = kind === "receipt" ? body.entries[0]?.date ?? null : null;
      onSaved?.(res, date);
      toast({ title: kind === "holdings" ? `${res.holdingCount} holding${res.holdingCount === 1 ? "" : "s"} saved` : res.entryCount ? "Receipt saved" : "Nothing new saved" });
    } catch (e) {
      setSaveError(`${errMsg(e)} Your reviewed draft is still here. Try saving again; it won't be saved twice.`);
    } finally { setFinishing(false); }
  };

  const title = kind === "holdings" ? "Import from a screenshot" : "Add from a receipt photo";
  const reviewing = !!rows || !!receipt;

  return (
    <><Dialog open={open} onOpenChange={guard.changeOpen}>
      <DialogContent className="flex max-h-[94dvh] min-w-0 flex-col gap-0 overflow-hidden bg-background p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 pb-4 pt-5 text-left">
          <p className="eyebrow">{result ? "Done" : reviewing ? "Step 2 of 2 · Review" : "Step 1 of 2 · Choose image"}</p>
          <DialogTitle className="font-display text-3xl font-normal">{title}</DialogTitle>
          <DialogDescription>{kind === "holdings" ? "A brokerage positions screenshot, such as Fidelity's Positions page. You check every field before anything is saved." : "We read the merchant, final total, and date. You confirm before it joins your budget."}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {result ? (
            <div className="py-6 text-center" role="status" data-testid="status-import-result">
              <CheckCircle2 className="mx-auto h-9 w-9 text-chart-2" />
              <p className="mt-3 font-display text-3xl">{result.alreadySaved ? "This import was already saved." : (result.holdingCount + result.entryCount) > 0 ? "Saved to your notebook." : "Nothing new to save."}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {kind === "holdings" ? `${result.holdingCount} holding${result.holdingCount === 1 ? "" : "s"} added.` : `${result.entryCount} expense added.`}
                {result.skippedCount > 0 && ` ${result.skippedCount} skipped because ${kind === "holdings" ? "that ticker is already in your holdings" : "an entry with the same merchant, date, and amount already exists"}. Nothing existing was changed.`}
              </p>
            </div>
          ) : (
            <div className={reviewing ? "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]" : "mx-auto max-w-lg space-y-4"}>
              <div className={reviewing ? "min-w-0 md:sticky md:top-0 md:self-start" : "min-w-0 space-y-4"}>
                <ImagePicker kind={kind} previewUrl={file?.url ?? null} fileName={file?.name ?? null} error={fileError} disabled={reading || saving} onFile={chooseFile} onClear={clearImage} />
                {!reviewing && <Disclosure />}
                {reading && (
                  <div role="status" aria-live="polite" className="mt-3 flex items-center gap-3 rounded-xl bg-secondary px-3 py-3 text-sm" data-testid="status-reading">
                    <ScanText className="h-4 w-4 animate-pulse text-accent" />
                    <span className="flex-1">Reading your image. This can take up to a minute.</span>
                    <Button type="button" size="sm" variant="ghost" onClick={stopReading} data-testid="button-stop-reading">Stop</Button>
                  </div>
                )}
              </div>
              {reviewing && (
                <div className="min-w-0 space-y-4">
                  {warnings.length > 0 && (
                    <div className="rounded-xl border border-chart-4/60 bg-chart-4/10 p-3 text-xs" role="note">
                      <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" />Double-check these</p>
                      <ul className="list-disc space-y-0.5 pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </div>
                  )}
                  {rows && <HoldingsReview rows={rows} onChange={setRows} existingSymbols={existingSymbols} allowDuplicates={allowDup} disabled={saving} />}
                  {receipt && <ReceiptReview form={receipt} onChange={setReceipt} disabled={saving} />}
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={allowDup} disabled={saving} onChange={(e) => setAllowDup(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--accent))]" data-testid="checkbox-allow-duplicates" />
                    <span>{kind === "holdings" ? "Also add tickers I already have as separate holdings. Off by default; existing records are never overwritten." : "Save even if the same merchant, date, and amount already exist."}</span>
                  </label>
                  {saveError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-save-error">{saveError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center gap-2 border-t bg-card px-5 py-3 sm:justify-between">
          {result ? (
            <Button className="ml-auto" onClick={() => onOpenChange(false)} data-testid="button-import-done">Done</Button>
          ) : (
            <>
              <p className="hidden text-xs text-muted-foreground sm:block" aria-live="polite">
                {reviewing ? (blocking > 0 ? `${blocking} ${kind === "holdings" ? "selected row" + (blocking === 1 ? " needs" : "s need") : "field" + (blocking === 1 ? " needs" : "s need")} attention` : kind === "holdings" && newHoldingCount === 0 ? "Select new rows, or allow duplicates to add separate holdings." : "Ready to save") : ""}
              </p>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="ghost" disabled={saving} onClick={() => guard.changeOpen(false)} data-testid="button-cancel-import">Cancel</Button>
                {reviewing ? (
                  <Button type="button" disabled={!canSave} onClick={save} data-testid="button-confirm-import">{saving ? "Saving..." : kind === "holdings" ? `Save ${newHoldingCount} holding${newHoldingCount === 1 ? "" : "s"}` : "Save expense"}</Button>
                ) : (
                  <Button type="button" disabled={!file || reading} onClick={read} data-testid="button-read-image"><ScanText className="mr-2 h-4 w-4" />{reading ? "Reading..." : "Read image"}</Button>
                )}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>{guard.prompt}</>
  );
}
