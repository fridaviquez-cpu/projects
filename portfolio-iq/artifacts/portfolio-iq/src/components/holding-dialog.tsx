import { useEffect, useState, type FormEvent } from "react";
import { useCreateHolding, useUpdateHolding, HoldingInputType, type Holding, type HoldingInputType as HType } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { centsToInput, errMsg, money, toCents, today, useRefreshWorkspace } from "@/lib/money";
import { useDraftGuard } from "@/hooks/use-draft-guard";

const blank = { symbol: "", name: "", type: "ETF" as HType, quantity: "", price: "", cost: "", notes: "", priceDate: today() };

export function HoldingDialog({ open, onOpenChange, holding }: { open: boolean; onOpenChange: (o: boolean) => void; holding?: Holding | null }) {
  const [f, setF] = useState(blank);
  const [baseline, setBaseline] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHolding();
  const update = useUpdateHolding();
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setError(null);
    const initial = holding ? { symbol: holding.symbol, name: holding.name, type: holding.type, quantity: String(holding.quantity), price: centsToInput(holding.priceCents), cost: centsToInput(holding.costBasisCents), notes: holding.notes, priceDate: holding.priceDate } : { ...blank, priceDate: today() };
    setF(initial); setBaseline(initial);
  }, [open, holding?.id]);

  const set = (k: keyof typeof blank) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const pending = create.isPending || update.isPending;
  const guard = useDraftGuard(open && JSON.stringify(f) !== JSON.stringify(baseline), pending, onOpenChange);
  const draftValue = Number(f.quantity) > 0 && Number.isFinite(toCents(f.price)) ? Math.round(Number(f.quantity) * (toCents(f.price) ?? 0)) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const quantity = Number(f.quantity);
    const priceCents = toCents(f.price);
    const costBasisCents = toCents(f.cost);
    if (!/^[A-Za-z0-9.^/-]{1,16}$/.test(f.symbol.trim())) return setError("Symbol can use letters, numbers and . ^ / - (up to 16).");
    if (!f.name.trim()) return setError("Give it a name you'll recognise.");
    if (!(quantity > 0)) return setError("Quantity must be more than zero.");
    if (priceCents == null || Number.isNaN(priceCents)) return setError("Enter the price per unit in dollars, with up to 2 decimal places (for example, 25.50).");
    if (Number.isNaN(costBasisCents as number)) return setError("Enter total paid with up to 2 decimal places, or leave it blank if unknown.");
    if (!f.priceDate) return setError("Add the date of your price snapshot.");
    const data = { symbol: f.symbol.trim().toUpperCase(), name: f.name.trim(), type: f.type, quantity, priceCents, costBasisCents, notes: f.notes, priceDate: f.priceDate };
    const done = { onSuccess: () => { refresh(); toast({ title: holding ? "Holding updated" : "Holding added", description: data.symbol }); onOpenChange(false); }, onError: (err: unknown) => setError(errMsg(err)) };
    if (holding) update.mutate({ id: holding.id, data }, done);
    else create.mutate({ data }, done);
  };

  return (
    <><Dialog open={open} onOpenChange={guard.changeOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">{holding ? `Edit ${holding.symbol}` : "Add a holding"}</DialogTitle>
          <DialogDescription>Enter a price you looked up yourself. PortfolioIQ never fetches live quotes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <fieldset disabled={pending} className="contents">
          <Field label="Ticker symbol" htmlFor="h-symbol" hint="The short name used by your broker."><Input id="h-symbol" maxLength={16} value={f.symbol} onChange={(e) => set("symbol")(e.target.value)} placeholder="For example, VTI" className="num uppercase" data-testid="input-symbol" /></Field>
          <Field label="Type" htmlFor="h-type">
            <Select value={f.type} onValueChange={set("type")}>
              <SelectTrigger id="h-type" data-testid="select-type"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.values(HoldingInputType).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="col-span-2"><Field label="Name" htmlFor="h-name"><Input id="h-name" maxLength={120} value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="Total Stock Market ETF" data-testid="input-name" /></Field></div>
          <Field label="Quantity" htmlFor="h-qty"><Input id="h-qty" inputMode="decimal" value={f.quantity} onChange={(e) => set("quantity")(e.target.value)} className="num" data-testid="input-quantity" /></Field>
          <Field label="Price per unit ($)" htmlFor="h-price"><Input id="h-price" inputMode="decimal" value={f.price} onChange={(e) => set("price")(e.target.value)} className="num" data-testid="input-price" /></Field>
          <Field label="Total paid ($, optional)" htmlFor="h-cost" hint="For all units, not per share. 10 shares × $20 paid = $200. Leave blank if unknown."><Input id="h-cost" inputMode="decimal" value={f.cost} onChange={(e) => set("cost")(e.target.value)} placeholder="Unknown" className="num" data-testid="input-cost" /></Field>
          <Field label="Price as of" htmlFor="h-date"><Input id="h-date" type="date" value={f.priceDate} onChange={(e) => set("priceDate")(e.target.value)} data-testid="input-price-date" /></Field>
          <div className="col-span-2"><Field label="Notes" htmlFor="h-notes"><Textarea id="h-notes" value={f.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={2000} placeholder="Why do you own this?" data-testid="input-notes" /></Field></div>
          {draftValue !== null && <p className="col-span-2 rounded-lg bg-secondary px-3 py-2 text-sm" role="status">Position value: <strong className="num">{money(draftValue)}</strong><span className="ml-2 text-xs text-muted-foreground">Quantity × entered price. Not saved yet.</span></p>}
          {error && <p role="alert" className="col-span-2 text-sm text-destructive">{error}</p>}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => guard.changeOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending} data-testid="button-save-holding">{pending ? "Saving..." : holding ? "Save changes" : "Add holding"}</Button>
          </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>{guard.prompt}</>
  );
}
