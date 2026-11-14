import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutGrid, Columns3, Archive, FileText, MessageSquareText, Fingerprint, LineChart, Settings, Menu, X, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/kit';
import { useSaveStatus } from '@/lib/career-client';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/opportunities', label: 'Opportunities', icon: Columns3 },
  { href: '/vault', label: 'Vault', icon: Archive },
  { href: '/resumes', label: 'Resumes', icon: FileText },
  { href: '/coach', label: 'Coach', icon: MessageSquareText },
  { href: '/dna', label: 'Career DNA', icon: Fingerprint },
  { href: '/insights', label: 'Insights', icon: LineChart },
];

function NavLinks({ onNav }: { onNav?: () => void }) {
  const [loc] = useLocation();
  const items = [...NAV, { href: '/settings', label: 'Settings', icon: Settings }];
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? loc === '/' : loc.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            aria-current={active ? 'page' : undefined}
            data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
              href === '/settings' && 'mt-4',
            )}
          >
            {active && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-foreground" />}
            <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Account() {
  const s = useSaveStatus();
  if (s.state === 'checking') return <div className="h-11 rounded-lg bg-card/60" aria-hidden="true" />;
  if (s.state === 'error')
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/[0.06] p-4" data-testid="status-save-error">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-destructive"><AlertCircle className="h-3.5 w-3.5" />Not saved</div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{s.message}</p>
        <Link href="/settings" className="mt-2 inline-block text-[12px] underline underline-offset-4">Open settings</Link>
      </div>
    );
  return (
    <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="status-saved" title="Your work is stored in this browser. Open settings to back it up.">
      <span className="save-dot h-1.5 w-1.5 shrink-0 rounded-full bg-signal" aria-hidden="true" />
      <span role="status" className="text-[12.5px] text-muted-foreground">Saved on this device</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => { setOpen(false); }, [loc]);
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) menuRef.current?.focus();
    wasOpen.current = open;
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div className="relative z-[1] min-h-[100dvh]">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-sidebar-border px-4 py-6 lg:flex">
        <Link href="/" className="mb-10 px-3" data-testid="link-home"><Wordmark /></Link>
        <NavLinks />
        <div className="mt-auto"><Account /></div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-5 backdrop-blur lg:hidden">
        <Link href="/"><Wordmark className="text-[17px]" /></Link>
        <Button ref={menuRef} size="icon" variant="ghost" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)} aria-label="Open menu" data-testid="button-menu"><Menu className="h-5 w-5" /></Button>
      </header>
      {open && (
        <div id="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="rise absolute inset-y-0 right-0 flex w-[280px] flex-col border-l bg-background p-5">
            <div className="mb-8 flex items-center justify-between">
              <Wordmark className="text-[17px]" />
              <Button ref={closeRef} size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></Button>
            </div>
            <NavLinks onNav={() => setOpen(false)} />
            <div className="mt-auto"><Account /></div>
          </div>
        </div>
      )}

      <main id="main" tabIndex={-1} className="lg:pl-[240px] focus:outline-none">
        <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-8 md:px-10 md:pt-14">{children}</div>
      </main>
    </div>
  );
}
