import { useEffect, useId, useRef, useState } from 'react';
import { ImageUp, X, RotateCw, ShieldCheck } from 'lucide-react';
import {
  useReadCareerScreenshots,
  type ScreenshotDraft, type ScreenshotImage, type ScreenshotImageContentType, type ScreenshotInputTarget,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/kit';
import { errMsg } from '@/lib/orvyn';
import { cn } from '@/lib/utils';

const TYPES: ScreenshotImageContentType[] = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILES = 5;
const MAX_EACH = 5 * 1024 * 1024;
const MAX_TOTAL = 10 * 1024 * 1024;

type Item = { id: string; file: File; url: string };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function readBase64(f: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error(`Could not read ${f.name} from your device.`));
    r.readAsDataURL(f);
  });
}

/**
 * Reusable screenshot reader. Sends selected images once to be read and returns
 * an editable draft through onResult. It never saves anything itself.
 * Results arriving after unmount, cancel, or a newer request are ignored.
 */
export function ScreenshotUpload({
  target, onResult, label = 'Screenshots', hint, disabled, className, testId = 'screenshot-upload',
}: {
  target: ScreenshotInputTarget;
  onResult: (draft: ScreenshotDraft) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  const read = useReadCareerScreenshots();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const mounted = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const mutateRef = useRef(read.mutateAsync);
  mutateRef.current = read.mutateAsync;
  const uid = useId();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reqId.current++;
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  const add = (list: File[]) => {
    if (pending || disabled || !list.length) return;
    setError(null);
    setWarnings([]);
    const cur = itemsRef.current;
    const bad = list.find((f) => !TYPES.includes(f.type as ScreenshotImageContentType));
    if (bad) return setError(`${bad.name || 'That file'} is not a PNG, JPEG or WebP image.`);
    const empty = list.find((f) => f.size < 1);
    if (empty) return setError(`${empty.name || 'That image'} is empty.`);
    const big = list.find((f) => f.size > MAX_EACH);
    if (big) return setError(`${big.name} is ${mb(big.size)}. Each screenshot must be 5 MB or less.`);
    if (cur.length + list.length > MAX_FILES) return setError(`Choose up to ${MAX_FILES} screenshots at a time.`);
    const total = [...cur.map((i) => i.file), ...list].reduce((n, f) => n + f.size, 0);
    if (total > MAX_TOTAL) return setError(`These screenshots add up to ${mb(total)}. The limit is 10 MB in total.`);
    const next = list.map((file, i) => ({ id: `${Date.now()}-${i}-${file.name}`, file, url: URL.createObjectURL(file) }));
    setItems([...cur, ...next]);
  };

  const remove = (id: string) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (it) URL.revokeObjectURL(it.url);
    setItems((p) => p.filter((i) => i.id !== id));
    setError(null);
  };

  const clear = () => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setError(null);
    setWarnings([]);
  };

  const cancel = () => {
    reqId.current++;
    setPending(false);
    setError(null);
  };

  const run = async () => {
    if (!items.length || pending || disabled) return;
    const my = ++reqId.current;
    setPending(true);
    setError(null);
    setWarnings([]);
    try {
      const images: ScreenshotImage[] = await Promise.all(items.map(async (i) => ({
        fileName: (i.file.name || 'screenshot').slice(0, 250),
        contentType: i.file.type as ScreenshotImageContentType,
        dataBase64: await readBase64(i.file),
      })));
      if (!mounted.current || my !== reqId.current) return;
      const out = await mutateRef.current({ data: { target, images } });
      if (!mounted.current || my !== reqId.current) return;
      const w = Array.isArray(out.warnings) ? out.warnings.filter((x) => typeof x === 'string') : [];
      setWarnings(w);
      onResultRef.current(out);
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
      setItems([]);
    } catch (e) {
      if (!mounted.current || my !== reqId.current) return;
      setError(errMsg(e));
    } finally {
      if (mounted.current && my === reqId.current) setPending(false);
    }
  };

  const total = items.reduce((n, i) => n + i.file.size, 0);
  const off = pending || !!disabled;

  return (
    <div className={cn('space-y-3', className)} data-testid={testId}>
      <div className="flex items-center justify-between">
        <span id={`${uid}-label`} className="text-[12px] text-muted-foreground">{label}</span>
        {items.length > 0 && <span className="font-mono text-[11px] text-muted-foreground">{items.length}/{MAX_FILES} / {mb(total)}</span>}
      </div>
      <input
        ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" tabIndex={-1}
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; add(fs); }}
        data-testid={`${testId}-input`}
      />
      <div
        role="button"
        tabIndex={off ? -1 : 0}
        aria-labelledby={`${uid}-label`}
        aria-describedby={`${uid}-help ${uid}-privacy`}
        aria-disabled={off}
        onClick={() => !off && inputRef.current?.click()}
        onKeyDown={(e) => { if (!off && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
        onPaste={(e) => {
          const fs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
          if (fs.length) { e.preventDefault(); add(fs); }
        }}
        onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); if (!off) setDragging(true); } }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = off ? 'none' : 'copy'; } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); if (!off) add(Array.from(e.dataTransfer.files)); }}
        className={cn('flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dragging ? 'border-foreground bg-accent' : 'border-border bg-background hover:border-muted-foreground',
          off && 'cursor-not-allowed opacity-60')}
        data-testid={`${testId}-dropzone`}
      >
        <ImageUp aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
        <span className="text-[13px]">{dragging ? 'Drop screenshots here' : 'Drop, paste or click to choose screenshots'}</span>
        <span id={`${uid}-help`} className="text-[11.5px] text-muted-foreground">{hint ?? 'PNG, JPEG or WebP. 1 to 5 images of the same item, 5 MB each, 10 MB total.'}</span>
      </div>
      <p id={`${uid}-privacy`} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground" data-testid={`${testId}-privacy`}>
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>When you choose Read screenshots, these images are sent to AI for reading. Orvyn does not save copies of the images. Crop or hide private details first. Review the extracted text, then choose Save to keep it in this browser.</span>
      </p>
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Selected screenshots">
          {items.map((i) => (
            <li key={i.id} className="group relative overflow-hidden rounded-md border bg-background">
              <img src={i.url} alt={`Preview of ${i.file.name}`} className="h-20 w-full object-cover object-top" />
              <div className="truncate px-1.5 py-1 text-[10.5px] text-muted-foreground" title={i.file.name}>{i.file.name || 'Pasted image'}</div>
              <button type="button" onClick={() => remove(i.id)} disabled={pending} aria-label={`Remove ${i.file.name || 'screenshot'}`}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full border bg-card/90 text-muted-foreground hover:text-foreground disabled:opacity-50" data-testid={`${testId}-remove-${i.id}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite" className="space-y-2">
        {error && (
          <div className="space-y-2">
            <InlineError error={new Error(error)} />
            {items.length > 0 && !pending && <Button type="button" size="sm" variant="outline" onClick={run} data-testid={`${testId}-retry`}><RotateCw className="mr-1.5 h-3.5 w-3.5" />Try again</Button>}
          </div>
        )}
        {pending && <p className="text-[12.5px] text-muted-foreground">Reading {items.length} {items.length === 1 ? 'screenshot' : 'screenshots'}...</p>}
        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg border px-3 py-2 text-[12px] text-muted-foreground" data-testid={`${testId}-warnings`}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={run} disabled={off} aria-busy={pending} data-testid={`${testId}-read`}>{pending ? 'Reading...' : 'Read screenshots'}</Button>
          {pending
            ? <Button type="button" size="sm" variant="ghost" onClick={cancel} data-testid={`${testId}-cancel`}>Stop</Button>
            : <Button type="button" size="sm" variant="ghost" onClick={clear} data-testid={`${testId}-clear`}>Clear</Button>}
        </div>
      )}
    </div>
  );
}

/** Values the model returned that the user can choose to use instead of what they typed. */
export function ReplaceOffers({ offers, onUse, onDismiss }: {
  offers: { key: string; label: string; value: string }[];
  onUse: (keys: string[]) => void;
  onDismiss: () => void;
}) {
  if (!offers.length) return null;
  return (
    <div role="region" aria-label="Screenshot values that differ from yours" className="space-y-2 rounded-lg border bg-background p-3" data-testid="screenshot-conflicts">
      <p className="text-[12.5px]">Your entries were kept. The screenshot shows different values for:</p>
      <ul className="space-y-1.5">
        {offers.map((o) => (
          <li key={o.key} className="flex items-start justify-between gap-3 text-[12px]">
            <span className="min-w-0"><span className="text-muted-foreground">{o.label}: </span><span className="line-clamp-2 break-words">{o.value}</span></span>
            <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0" onClick={() => onUse([o.key])} data-testid={`button-use-${o.key}`}>Use this</Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {offers.length > 1 && <Button type="button" size="sm" variant="outline" onClick={() => onUse(offers.map((o) => o.key))} data-testid="button-use-all">Replace all</Button>}
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss} data-testid="button-keep-mine">Keep mine</Button>
      </div>
    </div>
  );
}
