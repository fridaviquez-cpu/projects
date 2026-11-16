import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Check, Copy, Compass, ExternalLink, Home, Library, Sparkles, Timer, HardDrive } from "lucide-react";
import { useTimer } from "@/lib/timer";
import { copyText, fmtClock } from "@/lib/store";
import { TAU_SITE } from "@/lib/content";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StorageNotice } from "@/components/storage-notice";
import { useDraftProtection } from "@/lib/drafts";

const nav = [
  { href: "/", label: "Today", icon: Home },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/ai", label: "AI Playbook", icon: Sparkles },
  { href: "/plan", label: "My Plan", icon: Compass },
  { href: "/toolkit", label: "Toolkit", icon: Library },
];

function Wordmark() {
  return (
    <Link href="/" className="group flex items-baseline gap-2" data-testid="link-home-logo">
      <span className="font-display text-3xl font-semibold tracking-tight text-[var(--gold)] transition-transform group-hover:-rotate-3">TAU</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--paper)]/70">Tactics</span>
    </Link>
  );
}

function MiniTimer() {
  const { state, remaining } = useTimer();
  if (state.status !== "running" && state.status !== "paused") return null;
  const ph = state.phases[state.index];
  return (
    <Link href="/focus" data-testid="link-mini-timer" className="flex items-center gap-2 rounded-full border border-[var(--gold)]/40 px-3 py-1.5 font-mono text-xs text-[var(--gold-soft)] hover:bg-white/5">
      <span className={cn("h-1.5 w-1.5 rounded-full", state.status === "running" ? "animate-pulse bg-[var(--gold)]" : "bg-white/40")} />
      {ph.kind === "focus" ? "Focus" : "Break"} {fmtClock(remaining)}
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  useDraftProtection();
  const [loc] = useLocation();
  const active = (h: string) => (h === "/" ? loc === "/" : loc.startsWith(h));
  return (
    <div className="min-h-[100dvh] md:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      <aside className="ink-panel fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between p-6 md:flex">
        <div>
          <Wordmark />
          <p className="mt-2 text-xs leading-relaxed text-[var(--paper)]/55">A study companion from the Tau Chapter of Alpha Phi Alpha Fraternity, Inc. Est. 1917.</p>
          <div className="gold-rule my-6" />
          <nav className="space-y-1" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
                className={cn("group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors", active(n.href) ? "bg-[var(--gold)] text-[var(--ink)] font-medium" : "text-[var(--paper)]/75 hover:bg-white/5 hover:text-[var(--paper)]")}>
                <n.icon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6"><MiniTimer /></div>
        </div>
        <div className="space-y-3 text-xs text-[var(--paper)]/55">
          <p className="flex items-start gap-2"><HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" />Everything you save stays in this browser, on this device. No account.</p>
          <a href={TAU_SITE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--gold-soft)] hover:underline" data-testid="link-original-site">Original Tau Tactics site <ExternalLink className="h-3 w-3" /></a>
        </div>
      </aside>

      <header className="ink-panel sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden">
        <Wordmark />
        <MiniTimer />
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-10"><StorageNotice />{children}</main>

      <nav aria-label="Mobile" className="ink-panel fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-white/10 md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} aria-label={n.label} aria-current={active(n.href) ? "page" : undefined} data-testid={`link-mobile-${n.label.toLowerCase().replace(/\s/g, "-")}`}
            className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px]", active(n.href) ? "text-[var(--gold)]" : "text-[var(--paper)]/60")}>
            <n.icon className="h-5 w-5" />
            {n.label === "AI Playbook" ? "AI" : n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="rise mb-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">{kicker}</p>
      <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{children}</div>}
    </header>
  );
}

export function CopyButton({ text, label = "Copy", testId, className }: { text: string; label?: string; testId: string; className?: string }) {
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  return (
    <button type="button" data-testid={testId}
      onClick={async () => {
        const ok = await copyText(text);
        setDone(ok);
        toast({ title: ok ? "Copied to clipboard" : "Couldn't copy", description: ok ? "Paste it wherever you need it." : "Select the text and copy manually." });
        setTimeout(() => setDone(false), 1600);
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:border-[var(--gold)] active:scale-95", className)}>
      {done ? <Check className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function DeviceNote({ children }: { children?: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <HardDrive className="h-3.5 w-3.5" /> {children ?? "Saved on this device only."}
    </p>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none",
  gold: "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-soft)] active:translate-y-0 disabled:opacity-40",
  ghost: "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition-all hover:border-[var(--gold)] active:scale-95 disabled:opacity-40",
};
