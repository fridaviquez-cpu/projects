import { useRef } from "react";
import { Camera, ImageUp, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTR } from "@/lib/image-import";

type Props = {
  kind: "holdings" | "receipt";
  previewUrl: string | null;
  fileName: string | null;
  error: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
};

export function Disclosure() {
  return (
    <div className="flex gap-3 rounded-xl border border-chart-2/40 bg-chart-2/10 p-3.5 text-xs leading-relaxed" data-testid="text-ai-disclosure">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-chart-2" />
      <p><span className="font-medium">Before you read it:</span> this image is sent to an AI service to extract the numbers. Crop or cover account numbers and anything personal first. PortfolioIQ does not keep the original image; only the fields you review and confirm are saved.</p>
    </div>
  );
}

export function ImagePicker({ kind, previewUrl, fileName, error, disabled, onFile, onClear }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); };
  const what = kind === "holdings" ? "a screenshot of your positions" : "a photo of the receipt";

  return (
    <div className="min-w-0 space-y-3">
      <input ref={fileRef} type="file" accept={ACCEPT_ATTR} className="sr-only" tabIndex={-1} aria-hidden onChange={pick} data-testid="input-image-file" />
      {kind === "receipt" && <input ref={camRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={pick} data-testid="input-image-camera" />}
      {previewUrl ? (
        <figure className="relative min-w-0 overflow-hidden rounded-xl border bg-secondary/60">
          <img src={previewUrl} alt={`Selected ${kind === "holdings" ? "screenshot" : "receipt"} preview`} className="mx-auto max-h-[42dvh] w-auto max-w-full object-contain" data-testid="img-import-preview" />
          <figcaption className="flex items-center gap-2 border-t bg-card px-3 py-2 text-xs">
            <span className="num min-w-0 flex-1 truncate text-muted-foreground">{fileName}</span>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => fileRef.current?.click()} data-testid="button-replace-image">Replace</Button>
            <Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={onClear} aria-label="Remove image" data-testid="button-clear-image"><X className="h-4 w-4" /></Button>
          </figcaption>
        </figure>
      ) : (
        <button type="button" disabled={disabled} onClick={() => fileRef.current?.click()} data-testid="button-choose-image"
          className="group flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input bg-card px-6 py-10 text-center transition-colors hover:border-accent hover:bg-accent/5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent transition-transform group-hover:-translate-y-0.5"><ImageUp className="h-5 w-5" /></span>
          <span className="font-display text-2xl">Choose {what}</span>
          <span className="text-xs text-muted-foreground">PNG, JPEG, or WebP up to 15 MB. Large images are resized on your device.</span>
        </button>
      )}
      {kind === "receipt" && !previewUrl && (
        <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => camRef.current?.click()} data-testid="button-take-photo"><Camera className="mr-2 h-4 w-4" />Take a photo</Button>
      )}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-image-error">{error}</p>}
    </div>
  );
}
