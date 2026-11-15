import { useEffect, useId, useRef, useState } from 'react';
import { ImageUp, X, RotateCw, ShieldCheck, Check, Loader2, AlertCircle } from 'lucide-react';
import {
  useReadCareerScreenshotBatch,
  type ScreenshotBatchInputTarget, type ScreenshotImage, type ScreenshotImageContentType, type ScreenshotFields,
} from '@workspace/api-client-react';
import { store, type CareerRecord, type RecordInput } from '@/lib/career-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineError, fitValue, type FieldDef } from '@/components/kit';
import { errMsg, toInput, useInvalidate } from '@/lib/orvyn';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TYPES: ScreenshotImageContentType[] = ['image/png', 'image/jpeg', 'image/webp'];
export const BATCH_MAX = 5;
const MAX_EACH = 5 * 1024 * 1024;
const MAX_TOTAL = 10 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

const NOUN: Record<ScreenshotBatchInputTarget, [string, string]> = {
  opportunity: ['opportunity', 'opportunities'],
  experience: ['entry', 'entries'],
  goal: ['goal', 'goals'],
};
const FALLBACK: Record<ScreenshotBatchInputTarget, string> = {
  opportunity: 'Imported opportunity', experience: 'Imported experience', goal: 'Imported goal',
};

type Entry = {
  key: number;
  file: File | null;
  name: string;
  size: number;
  url: string;
  status: 'reading' | 'ready' | 'error';
  error?: string;
  req: number;
  vals: Record<string, string>;
  filled: string[];
  warnings: string[];
  selected: boolean;
};

function readBase64(f: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error(`Could not read ${f.name} from your device.`));
    r.readAsDataURL(f);
  });
}

/** Build editable values for one screenshot using the page's own field definitions. */
export function draftToValues(target: ScreenshotBatchInputTarget, fields: FieldDef[], src: ScreenshotFields | undefined, defaults?: Partial<RecordInput>) {
  const vals: Record<string, string> = {};
  const filled: string[] = [];
  const raw = (src ?? {}) as Record<string, unknown>;
  const defs = (defaults ?? {}) as Record<string, unknown>;
  for (const f of fields) {
    const key = f.name as string;
    const x = fitValue(f, raw[key]);
    if (x) { vals[key] = x; filled.push(key); continue; }
    const d = defs[key];
    vals[key] = typeof d === 'string' ? fitValue(f, d) : '';
  }
  if (!vals.title?.trim()) vals.title = FALLBACK[target];
  return { vals, filled };
}

/**
 * One upload, up to five independent screenshots, one draft record each.
 * Reading starts as soon as images are chosen. Nothing is saved until the user
 * confirms, and then all ready, selected drafts are written in one storage write.
 */
export function ScreenshotBatchDialog({
  open, onOpenChange, target, fields, defaults, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: ScreenshotBatchInputTarget;
  fields: FieldDef[];
  defaults?: Partial<RecordInput>;
  onSaved?: (records: CareerRecord[]) => void;
}) {
  const read = useReadCareerScreenshotBatch();
  const mutateRef = useRef(read.mutateAsync);
  mutateRef.current = read.mutateAsync;
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const [notice, setNotice] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const savingRef = useRef(false);
  const gen = useRef(0);
  const seq = useRef(0);
  const reqSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const [one, many] = NOUN[target];

  const discard = () => {
    gen.current++;
    entriesRef.current.forEach((e) => URL.revokeObjectURL(e.url));
    entriesRef.current = [];
    setEntries([]);
    setNotice(null);
    setSaveErr(null);
    setDragging(false);
  };

  useEffect(() => { if (!open) discard(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  useEffect(() => () => { gen.current++; entriesRef.current.forEach((e) => URL.revokeObjectURL(e.url)); }, []);

  const patch = (key: number, fn: (e: Entry) => Entry) => {
    const next = entriesRef.current.map((e) => (e.key === key ? fn(e) : e));
    entriesRef.current = next;
    setEntries(next);
  };

  const readEntries = async (list: Entry[]) => {
    const myGen = gen.current;
    const req = ++reqSeq.current;
    const keys = list.map((e) => e.key);
    const files = list.map((e) => e.file);
    for (const k of keys) patch(k, (e) => ({ ...e, status: 'reading', error: undefined, req }));
    const stillMine = (k: number) => gen.current === myGen && entriesRef.current.some((e) => e.key === k && e.req === req);
    try {
      const images: ScreenshotImage[] = await Promise.all(list.map(async (e, i) => ({
        fileName: (e.name || `screenshot-${i + 1}`).slice(0, 250),
        contentType: (files[i]!.type as ScreenshotImageContentType),
        dataBase64: await readBase64(files[i]!),
      })));
      if (gen.current !== myGen) return;
      const out = await mutateRef.current({ data: { target, images } });
      if (gen.current !== myGen) return;
      const items = Array.isArray(out?.items) ? out.items : [];
      keys.forEach((k, i) => {
        if (!stillMine(k)) return;
        const it = items.find((x) => x.index === i);
        if (!it) return patch(k, (e) => ({ ...e, status: 'error', error: 'No result came back for this screenshot.' }));
        if (it.status !== 'ready' || !it.draft) return patch(k, (e) => ({ ...e, status: 'error', error: it.error || 'This screenshot could not be read.' }));
        const { vals, filled } = draftToValues(target, fields, it.draft.fields, defaults);
        const warnings = Array.isArray(it.draft.warnings) ? it.draft.warnings.filter((w) => typeof w === 'string') : [];
        patch(k, (e) => ({ ...e, status: 'ready', error: undefined, file: null, vals, filled, warnings }));
      });
    } catch (err) {
      if (gen.current !== myGen) return;
      const msg = errMsg(err);
      keys.forEach((k) => { if (stillMine(k)) patch(k, (e) => ({ ...e, status: 'error', error: msg })); });
    }
  };

  const add = (list: File[]) => {
    if (savingRef.current || !list.length) return;
    setNotice(null);
    setSaveErr(null);
    const cur = entriesRef.current;
    const bad = list.find((f) => !TYPES.includes(f.type as ScreenshotImageContentType));
    if (bad) return setNotice(`${bad.name || 'That file'} is not a PNG, JPEG or WebP image. Nothing was added.`);
    const empty = list.find((f) => f.size < 1);
    if (empty) return setNotice(`${empty.name || 'That image'} is empty. Nothing was added.`);
    const big = list.find((f) => f.size > MAX_EACH);
    if (big) return setNotice(`${big.name} is ${mb(big.size)}. Each screenshot must be 5 MB or less.`);
    const room = BATCH_MAX - cur.length;
    if (room <= 0) return setNotice(`This upload already has ${BATCH_MAX} screenshots, the most allowed. Save or remove one to add another.`);
    const take = list.slice(0, room);
    const total = cur.reduce((n, entry) => n + entry.size, 0) + take.reduce((n, f) => n + f.size, 0);
    if (total > MAX_TOTAL) return setNotice(`These screenshots add up to ${mb(total)}. The limit is 10 MB for the whole upload.`);
    if (list.length > room) setNotice(`Only ${BATCH_MAX} screenshots fit in one upload. ${list.length - room} ${list.length - room === 1 ? 'was' : 'were'} not added.`);
    const next: Entry[] = take.map((file) => ({
      key: ++seq.current, file, name: file.name || 'Pasted image', size: file.size, url: URL.createObjectURL(file),
      status: 'reading', req: 0, vals: {}, filled: [], warnings: [], selected: true,
    }));
    entriesRef.current = [...cur, ...next];
    setEntries(entriesRef.current);
    void readEntries(next);
  };

  const remove = (key: number) => {
    const e = entriesRef.current.find((x) => x.key === key);
    if (e) URL.revokeObjectURL(e.url);
    entriesRef.current = entriesRef.current.filter((x) => x.key !== key);
    setEntries(entriesRef.current);
    setNotice(null);
  };

  const retry = (key: number) => {
    const e = entriesRef.current.find((x) => x.key === key);
    if (!e || e.status !== 'error' || !e.file || savingRef.current) return;
    void readEntries([e]);
  };

  const reading = entries.some((e) => e.status === 'reading');
  const toSave = entries.filter((e) => e.status === 'ready' && e.selected);
  const canSave = !reading && !saving && toSave.length > 0;

  const save = () => {
    if (savingRef.current || reading) return;
    const ready = entriesRef.current.filter((e) => e.status === 'ready' && e.selected);
    if (!ready.length) return;
    savingRef.current = true;
    setSaving(true);
    setSaveErr(null);
    try {
      const inputs: RecordInput[] = ready.map((e) => {
        const p: Record<string, string | undefined> = {};
        for (const f of fields) p[f.name as string] = (e.vals[f.name as string] ?? '').trim() || undefined;
        if (!p.title) p.title = FALLBACK[target];
        return toInput({ ...(defaults ?? {}), kind: target } as CareerRecord, p as Partial<RecordInput>);
      });
      const saved = store.createMany(inputs);
      invalidate();
      toast({ title: `Saved ${saved.length} ${saved.length === 1 ? one : many} on this device`, description: saved.map((r) => r.title).join(', ').slice(0, 240) });
      discard();
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setSaveErr(errMsg(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const setVal = (key: number, name: string, v: string) => patch(key, (e) => ({ ...e, vals: { ...e.vals, [name]: v } }));
  const readyCount = entries.filter((e) => e.status === 'ready').length;
  const errorCount = entries.filter((e) => e.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && savingRef.current) return; onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto scroll-thin bg-card sm:max-w-[760px]" data-testid="screenshot-batch-dialog">
        <DialogHeader>
          <DialogTitle className="text-[19px] font-medium tracking-[-0.02em]">Add {many} from screenshots</DialogTitle>
          <DialogDescription>Each screenshot becomes its own {one}. Five screenshots, five {many}. Fields fill in on their own; change anything you like before saving.</DialogDescription>
        </DialogHeader>

        <p id={`${uid}-privacy`} className="flex items-start gap-2 rounded-lg border bg-background/50 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground" data-testid="screenshot-batch-privacy">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
          <span>Choosing images sends them to AI for reading right away, with no extra step. Orvyn does not keep the images, on the server or in this browser. Only the extracted text is saved, and only after you choose Save. Crop or hide private details first.</span>
        </p>

        <input
          ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" tabIndex={-1}
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; add(fs); }}
          data-testid="screenshot-batch-input"
        />
        <div
          role="button" tabIndex={saving || entries.length >= BATCH_MAX ? -1 : 0}
          aria-describedby={`${uid}-privacy`} aria-disabled={saving || entries.length >= BATCH_MAX}
          onClick={() => !saving && entries.length < BATCH_MAX && inputRef.current?.click()}
          onKeyDown={(e) => { if (!saving && entries.length < BATCH_MAX && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
          onPaste={(e) => { const fs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); add(fs); } }}
          onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); add(Array.from(e.dataTransfer.files)); }}
          className={cn('flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dragging ? 'border-foreground bg-accent' : 'border-border bg-background hover:border-muted-foreground',
            (saving || entries.length >= BATCH_MAX) && 'cursor-not-allowed opacity-60')}
          data-testid="screenshot-batch-dropzone"
        >
          <ImageUp aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="flex flex-col">
            <span className="text-[13px]">{dragging ? 'Drop screenshots here' : 'Drop, paste or click to choose up to 5 screenshots'}</span>
            <span className="text-[11.5px] text-muted-foreground">PNG, JPEG or WebP. One {one} per image. 5 MB each, 10 MB per selection.</span>
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground" data-testid="text-batch-count">{entries.length}/{BATCH_MAX}</span>
        </div>

        <div aria-live="polite" className="space-y-2">
          {notice && <InlineError error={new Error(notice)} />}
          {entries.length > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground" data-testid="text-batch-progress">
              {reading ? `Reading ${entries.filter((e) => e.status === 'reading').length} of ${entries.length}` : `${readyCount} ready${errorCount ? ` / ${errorCount} failed` : ''}`}
            </p>
          )}
        </div>

        {entries.length > 0 && (
          <ol className="space-y-3" aria-label="Screenshot drafts">
            {entries.map((e, i) => (
              <li key={e.key} className={cn('rise rounded-xl border bg-background/40 p-3', e.status === 'error' && 'border-destructive/40', e.status === 'ready' && !e.selected && 'opacity-60')} data-testid={`batch-item-${i}`}>
                <div className="flex items-start gap-3">
                  <img src={e.url} alt={`Preview of ${e.name}`} className="h-16 w-16 shrink-0 rounded-md border object-cover object-top" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate text-[13px]" title={e.name} data-testid={`text-batch-filename-${i}`}>{e.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[12px]" data-testid={`status-batch-${i}`} data-status={e.status}>
                      {e.status === 'reading' && <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Reading...</span></>}
                      {e.status === 'ready' && <><Check className="h-3.5 w-3.5 text-signal" /><span className="text-signal">Ready{e.filled.length ? `, ${e.filled.length} ${e.filled.length === 1 ? 'field' : 'fields'} filled` : ', no details found'}</span></>}
                      {e.status === 'error' && <><AlertCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive" data-testid={`text-batch-error-${i}`}>{e.error}</span></>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {e.status === 'ready' && (
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground">
                        <input type="checkbox" checked={e.selected} disabled={saving} onChange={(ev) => patch(e.key, (x) => ({ ...x, selected: ev.target.checked }))} className="accent-[hsl(var(--signal))]" data-testid={`checkbox-batch-select-${i}`} />
                        Save
                      </label>
                    )}
                    {e.status === 'error' && e.file && (
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => retry(e.key)} disabled={saving} data-testid={`button-batch-retry-${i}`}><RotateCw className="mr-1 h-3 w-3" />Retry</Button>
                    )}
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(e.key)} disabled={saving} aria-label={`Remove ${e.name}`} data-testid={`button-batch-remove-${i}`}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {e.status === 'ready' && (
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3">
                    {fields.map((f) => {
                      const name = f.name as string;
                      const id = `${uid}-${e.key}-${name}`;
                      const v = e.vals[name] ?? '';
                      const tid = `batch-${i}-${name}`;
                      return (
                        <div key={name} className={cn('space-y-1', f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2')}>
                          <Label htmlFor={id} className="text-[11.5px] font-normal text-muted-foreground">{f.label}{e.filled.includes(name) && <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-wider text-signal">read</span>}</Label>
                          {f.type === 'textarea' ? (
                            <Textarea id={id} rows={2} value={v} onChange={(ev) => setVal(e.key, name, ev.target.value)} className="min-h-[56px] resize-y bg-background text-[13px]" data-testid={`input-${tid}`} />
                          ) : f.type === 'select' ? (
                            <Select value={v} onValueChange={(nv) => setVal(e.key, name, nv)}>
                              <SelectTrigger id={id} className="h-9 bg-background text-[13px]" data-testid={`select-${tid}`}><SelectValue placeholder="Choose" /></SelectTrigger>
                              <SelectContent>{f.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Input id={id} type={f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : f.type === 'url' ? 'url' : 'text'} value={v} onChange={(ev) => setVal(e.key, name, ev.target.value)} className="h-9 bg-background text-[13px]" data-testid={`input-${tid}`} />
                          )}
                        </div>
                      );
                    })}
                    {e.warnings.length > 0 && (
                      <ul className="col-span-2 space-y-0.5 text-[11.5px] text-muted-foreground" data-testid={`text-batch-warnings-${i}`}>{e.warnings.map((w, j) => <li key={j}>{w}</li>)}</ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {saveErr && <div data-testid="text-batch-save-error"><InlineError error={new Error(`${saveErr} Nothing was saved. Your drafts are still here.`)} /></div>}

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} data-testid="button-cancel-batch">Cancel</Button>
          <Button type="button" onClick={save} disabled={!canSave} aria-busy={saving} data-testid="button-save-batch">
            {saving ? 'Saving...' : reading ? 'Reading screenshots...' : `Save ${toSave.length} ${toSave.length === 1 ? one : many}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
