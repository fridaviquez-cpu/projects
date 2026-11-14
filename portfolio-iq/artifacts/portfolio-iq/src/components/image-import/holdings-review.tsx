import { AlertTriangle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HOLDING_TYPES, holdingProblems, type HoldingRow } from "@/lib/image-import";
import { cn } from "@/lib/utils";

type Props = { rows: HoldingRow[]; onChange: (rows: HoldingRow[]) => void; existingSymbols: Set<string>; allowDuplicates: boolean; disabled: boolean };

function Cell({ id, label, error, className, children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export function HoldingsReview({ rows, onChange, existingSymbols, allowDuplicates, disabled }: Props) {
  const patch = (k: string, p: Partial<HoldingRow>) => onChange(rows.map((r) => (r.key === k ? { ...r, ...p } : r)));
  const selected = rows.filter((r) => r.selected).length;
  const allOn = selected === rows.length;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p><span className="num">{selected}</span> of <span className="num">{rows.length}</span> rows selected</p>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(rows.map((r) => ({ ...r, selected: !allOn })))} data-testid="button-toggle-all-rows">{allOn ? "Deselect all" : "Select all"}</Button>
      </div>
      <ul className="space-y-3">
        {rows.map((r, i) => {
          const p = holdingProblems(r);
          const id = `ih-${r.key}`;
          const dup = existingSymbols.has(r.symbol.trim().toUpperCase());
          const err = (k: keyof HoldingRow) => (r.selected ? p[k] : undefined);
          const inv = (k: keyof HoldingRow) => ({ "aria-invalid": !!err(k) || undefined, "aria-describedby": err(k) ? `${id}-${k}-err` : undefined, className: cn("h-9 min-w-0 max-w-full bg-background", err(k) && "border-destructive") });
          return (
            <li key={r.key} className={cn("min-w-0 rounded-xl border bg-card p-3 transition-opacity", !r.selected && "opacity-55")} data-testid={`row-import-holding-${i}`}>
              <div className="mb-2 flex items-center gap-2">
                <input id={`${id}-sel`} type="checkbox" checked={r.selected} disabled={disabled} onChange={(e) => patch(r.key, { selected: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--accent))]" data-testid={`checkbox-import-holding-${i}`} />
                <label htmlFor={`${id}-sel`} className="num min-w-0 flex-1 break-all text-sm font-medium">{r.symbol || `Row ${i + 1}`}</label>
                {dup && <span className="rounded bg-chart-4/20 px-1.5 py-0.5 text-[10px]">{allowDuplicates ? "Already held · adding separately" : "Already in holdings, will be skipped"}</span>}
                <Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label={`Remove row ${r.symbol || i + 1}`} data-testid={`button-remove-import-holding-${i}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <fieldset disabled={disabled || !r.selected} className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-6">
                <Cell id={`${id}-symbol`} label="Symbol" error={err("symbol")}><Input id={`${id}-symbol`} value={r.symbol} maxLength={16} onChange={(e) => patch(r.key, { symbol: e.target.value })} {...inv("symbol")} /></Cell>
                <Cell id={`${id}-name`} label="Name" error={err("name")} className="sm:col-span-3"><Input id={`${id}-name`} value={r.name} maxLength={120} onChange={(e) => patch(r.key, { name: e.target.value })} {...inv("name")} /></Cell>
                <Cell id={`${id}-type`} label="Type" error={err("type")} className="sm:col-span-2">
                  <select id={`${id}-type`} value={r.type} onChange={(e) => patch(r.key, { type: e.target.value as HoldingRow["type"] })} {...inv("type")} className={cn("h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm", err("type") && "border-destructive")}>
                    <option value="">Choose...</option>{HOLDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Cell>
                <Cell id={`${id}-quantity`} label="Quantity" error={err("quantity")}><Input id={`${id}-quantity`} inputMode="decimal" value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} {...inv("quantity")} /></Cell>
                <Cell id={`${id}-price`} label="Price ($)" error={err("price")}><Input id={`${id}-price`} inputMode="decimal" value={r.price} onChange={(e) => patch(r.key, { price: e.target.value })} {...inv("price")} /></Cell>
                <Cell id={`${id}-costBasis`} label="Total paid ($)" error={err("costBasis")} className="sm:col-span-2"><Input id={`${id}-costBasis`} inputMode="decimal" placeholder="Unknown" value={r.costBasis} onChange={(e) => patch(r.key, { costBasis: e.target.value })} {...inv("costBasis")} /></Cell>
                <Cell id={`${id}-priceDate`} label={r.dateWasRead ? "Price date (read)" : "Price date (not in image)"} error={err("priceDate")} className="sm:col-span-2"><Input id={`${id}-priceDate`} type="date" value={r.priceDate} onChange={(e) => patch(r.key, { priceDate: e.target.value })} {...inv("priceDate")} /></Cell>
                <Cell id={`${id}-notes`} label="Notes (optional)" className="col-span-2 sm:col-span-6"><Textarea id={`${id}-notes`} value={r.notes} maxLength={2000} onChange={(e) => patch(r.key, { notes: e.target.value })} className="min-h-16 bg-background" /></Cell>
              </fieldset>
              {r.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">{r.warnings.map((w, j) => <li key={j} className="flex gap-1.5 text-[11px] text-chart-4 [color:hsl(36_70%_34%)]"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{w}</li>)}</ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
