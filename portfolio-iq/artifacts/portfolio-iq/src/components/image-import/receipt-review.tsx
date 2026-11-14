import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/kit";
import { receiptProblems, type ReceiptForm } from "@/lib/image-import";
import { cn } from "@/lib/utils";

const CATS = ["Groceries", "Housing", "Transport", "Utilities", "Health", "Dining", "Shopping", "Other expenses"];

export function ReceiptReview({ form, onChange, disabled }: { form: ReceiptForm; onChange: (f: ReceiptForm) => void; disabled: boolean }) {
  const p = receiptProblems(form);
  const set = (k: keyof ReceiptForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...form, [k]: e.target.value });
  const cls = (k: keyof ReceiptForm) => cn("bg-background", p[k] && "border-destructive");
  const err = (k: keyof ReceiptForm) => p[k] && <p className="mt-1 text-[11px] text-destructive">{p[k]}</p>;
  return (
    <fieldset disabled={disabled} className="grid min-w-0 grid-cols-2 gap-4">
      <p className="col-span-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">Saved as one <span className="font-medium text-foreground">Expense</span> for the final total you paid, including tax and tip. Line items are not added.</p>
      <div className="col-span-2"><Field label="Merchant or description" htmlFor="ir-desc"><Input id="ir-desc" maxLength={160} value={form.description} onChange={set("description")} className={cls("description")} aria-invalid={!!p.description || undefined} data-testid="input-receipt-description" />{err("description")}</Field></div>
      <Field label="Category" htmlFor="ir-cat"><Input id="ir-cat" list="ir-cats" maxLength={50} value={form.category} onChange={set("category")} className={cls("category")} aria-invalid={!!p.category || undefined} data-testid="input-receipt-category" />{err("category")}</Field>
      <datalist id="ir-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist>
      <Field label="Total paid ($)" htmlFor="ir-amt"><Input id="ir-amt" inputMode="decimal" value={form.amount} onChange={set("amount")} className={cn("num", cls("amount"))} aria-invalid={!!p.amount || undefined} data-testid="input-receipt-amount" />{err("amount")}</Field>
      <div className="col-span-2"><Field label={form.dateWasRead ? "Date (read from receipt)" : "Date (not found on receipt, please choose)"} htmlFor="ir-date"><Input id="ir-date" type="date" value={form.date} onChange={set("date")} className={cls("date")} aria-invalid={!!p.date || undefined} data-testid="input-receipt-date" />{err("date")}</Field></div>
      <div className="col-span-2"><Field label="Notes" htmlFor="ir-notes"><Textarea id="ir-notes" maxLength={2000} value={form.notes} onChange={set("notes")} className="bg-background" /></Field></div>
      {form.warnings.length > 0 && (
        <ul className="col-span-2 space-y-1">{form.warnings.map((w, j) => <li key={j} className="flex gap-1.5 text-xs [color:hsl(36_70%_34%)]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</li>)}</ul>
      )}
    </fieldset>
  );
}
