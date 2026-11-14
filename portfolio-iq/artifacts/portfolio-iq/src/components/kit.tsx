import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, lede, action }: { eyebrow: string; title: string; lede?: string; action?: ReactNode }) {
  return (
    <header className="rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-4xl md:text-5xl leading-[1.05] text-foreground" data-testid="text-page-title">{title}</h1>
        {lede && <p className="mt-3 max-w-xl text-[15px] text-muted-foreground">{lede}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </header>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-1/3 bg-secondary" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl bg-secondary" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="paper flex flex-col items-start gap-3 p-6">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <div>
        <p className="font-display text-2xl">That didn't load.</p>
        <p className="text-sm text-muted-foreground">{message ?? "The server didn't answer. Your saved data is untouched."}</p>
      </div>
      <Button variant="outline" onClick={onRetry} data-testid="button-retry"><RotateCw className="mr-2 h-4 w-4" />Try again</Button>
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon: ReactNode; title: string; body: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-input bg-card/60 px-6 py-14 text-center", className)}>
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-accent">{icon}</div>
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SampleTag() {
  return <span className="num rounded bg-primary px-1.5 py-0.5 text-[9.5px] tracking-widest text-primary-foreground">SAMPLE</span>;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">{label}</label>
      {hint && isValidElement(children) ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": `${htmlFor}-hint` }) : children}
      {hint && <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
