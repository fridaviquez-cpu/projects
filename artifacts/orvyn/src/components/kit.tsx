import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';
import type { CareerRecord, RecordInput, RecordInputKind } from '@/lib/career-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { errMsg, toInput, useRecordMutations } from '@/lib/orvyn';
import { useToast } from '@/hooks/use-toast';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-[-0.04em] text-[19px]', className)}>
      <span className="relative inline-block h-[14px] w-[14px] rounded-full border-[1.5px] border-foreground">
        <span className="absolute right-[-3px] top-[-3px] h-[6px] w-[6px] rounded-full bg-signal" />
      </span>
      orvyn
    </span>
  );
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rise mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <div className="eyebrow mb-3">{eyebrow}</div>
        <h1 className="text-[30px] md:text-[38px] leading-[1.05] font-medium tracking-[-0.035em]">{title}</h1>
        {sub && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border bg-card', className)} {...rest}>{children}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center" data-testid="empty-state">
      <div className="mb-5 grid h-11 w-11 place-items-center rounded-full border bg-card text-muted-foreground">{icon}</div>
      <h3 className="text-[16px] font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/[0.06] p-5" data-testid="error-state">
      <div className="flex items-center gap-2 text-[14px] font-medium text-destructive"><AlertCircle className="h-4 w-4" />Could not load this</div>
      <p className="text-[13px] text-muted-foreground">{errMsg(error)}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry"><RotateCw className="mr-1.5 h-3.5 w-3.5" />Try again</Button>}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.06] px-3 py-2.5 text-[13px] text-destructive" data-testid="text-error">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{errMsg(error)}</span>
    </div>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-1/3 bg-muted" />
          <Skeleton className="mt-3 h-3 w-2/3 bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function AiNotice({ className }: { className?: string }) {
  return (
    <p className={cn('text-[12px] leading-relaxed text-muted-foreground', className)}>
      AI uses the career information you submit here (records, resume text, job descriptions, answers) to generate a draft.
      Review every generated draft for accuracy before you use it.
    </p>
  );
}

export function StatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const tone: Record<string, string> = {
    offer: 'text-signal border-signal/40',
    interview: 'text-[hsl(38_80%_70%)] border-[hsl(38_80%_66%/0.4)]',
    assessment: 'text-[hsl(210_60%_74%)] border-[hsl(210_60%_68%/0.4)]',
    rejected: 'text-muted-foreground line-through decoration-1',
    withdrawn: 'text-muted-foreground',
    completed: 'text-signal border-signal/40',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider', tone[status] ?? 'text-muted-foreground')}>
      {status}
    </span>
  );
}

export type FieldDef = {
  name: keyof RecordInput;
  label: string;
  type?: 'text' | 'textarea' | 'date' | 'datetime' | 'select' | 'url';
  options?: { value: string; label: string }[];
  placeholder?: string;
  half?: boolean;
  required?: boolean;
  rows?: number;
};

export function RecordDialog({
  open, onOpenChange, kind, heading, description, fields, record, defaults, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: RecordInputKind;
  heading: string;
  description?: string;
  fields: FieldDef[];
  record?: CareerRecord | null;
  defaults?: Partial<RecordInput>;
  onSaved?: (r: CareerRecord) => void;
}) {
  const { create, update } = useRecordMutations();
  const { toast } = useToast();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const base: Record<string, string> = {};
    const src = { ...(defaults ?? {}), ...(record ?? {}) } as Record<string, unknown>;
    for (const f of fields) {
      const v = src[f.name as string];
      let s = typeof v === 'string' ? v : '';
      if (f.type === 'datetime' && s) s = s.slice(0, 16);
      if (f.type === 'date' && s) s = s.slice(0, 10);
      base[f.name as string] = s;
    }
    setVals(base);
    setTouched(false);
    create.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  const pending = create.isPending || update.isPending;
  const err = create.error || update.error;
  const titleMissing = !vals.title?.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (titleMissing) return;
    const patch: Record<string, string | undefined> = {};
    for (const f of fields) {
      const v = (vals[f.name as string] ?? '').trim();
      patch[f.name as string] = record ? v : (v || undefined);
    }
    const done = (r: CareerRecord) => {
      toast({ title: record ? 'Changes saved on this device' : 'Saved on this device', description: r.title });
      onSaved?.(r);
      onOpenChange(false);
    };
    if (record) {
      const input = toInput(record, patch as Partial<RecordInput>);
      update.mutate({ id: record.id, data: input }, { onSuccess: done });
    } else {
      const data = toInput({ ...(defaults ?? {}), kind } as CareerRecord, patch as Partial<RecordInput>);
      create.mutate({ data }, { onSuccess: done });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto scroll-thin sm:max-w-[620px] bg-card"
        onOpenAutoFocus={() => {
          const active = document.activeElement;
          // Menu items unmount on selection; return to their persistent trigger.
          const menu = active?.closest('[role="menu"]');
          const triggerId = menu?.getAttribute('aria-labelledby');
          returnFocus.current = (triggerId ? document.getElementById(triggerId) : active) as HTMLElement | null;
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[19px] font-medium tracking-[-0.02em]">{heading}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-x-4 gap-y-4 pt-2">
          {fields.map((f) => {
            const id = `field-${String(f.name)}`;
            const v = vals[f.name as string] ?? '';
            const set = (nv: string) => setVals((p) => ({ ...p, [f.name as string]: nv }));
            return (
              <div key={String(f.name)} className={cn('space-y-1.5', f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2')}>
                <Label htmlFor={id} className="text-[12px] font-normal text-muted-foreground">{f.label}{f.required && ' *'}</Label>
                {f.type === 'textarea' ? (
                  <Textarea id={id} rows={f.rows ?? 4} value={v} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} className="bg-background resize-y" data-testid={`input-${String(f.name)}`} />
                ) : f.type === 'select' ? (
                  <Select value={v} onValueChange={set}>
                    <SelectTrigger id={id} className="bg-background" data-testid={`select-${String(f.name)}`}><SelectValue placeholder={f.placeholder ?? 'Choose'} /></SelectTrigger>
                    <SelectContent>{f.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input id={id} type={f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : f.type === 'url' ? 'url' : 'text'} value={v} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} className="bg-background" data-testid={`input-${String(f.name)}`} />
                )}
                {f.name === 'title' && touched && titleMissing && <p className="text-[12px] text-destructive">Required</p>}
              </div>
            );
          })}
          <div className="col-span-2"><InlineError error={err} /></div>
          <DialogFooter className="col-span-2 gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending} data-testid="button-save">{pending ? 'Saving...' : record ? 'Save changes' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDelete({ record, onOpenChange, what = 'record', onDeleted }: { record: CareerRecord | null; onOpenChange: (o: boolean) => void; what?: string; onDeleted?: () => void }) {
  const { remove, restore } = useRecordMutations();
  const { toast } = useToast();
  return (
    <AlertDialog open={!!record} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {what}?</AlertDialogTitle>
          <AlertDialogDescription>"{record?.title}" will be removed from this device. You can undo right after deleting.</AlertDialogDescription>
        </AlertDialogHeader>
        <InlineError error={remove.error} />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete"
            onClick={(e) => {
              e.preventDefault();
              if (!record) return;
              remove.mutate({ id: record.id }, {
                onSuccess: (removed) => {
                  const t = toast({
                    title: 'Deleted', description: removed.title,
                    action: <ToastAction altText="Undo delete" data-testid="button-undo-delete" onClick={() => restore.mutate(removed, {
                      onSuccess: () => { t.dismiss(); toast({ title: 'Restored', description: removed.title }); },
                      onError: (er) => toast({ title: 'Could not restore', description: errMsg(er), variant: 'destructive' }),
                    })}>Undo</ToastAction>,
                  });
                  onDeleted?.(); onOpenChange(false);
                },
              });
            }}
          >
            {remove.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
