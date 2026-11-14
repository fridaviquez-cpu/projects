import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, CircleHelp, Compass, Library, LayoutDashboard, Layers, Menu, MessageCircle, NotebookPen, Settings, Sprout, Wallet, Send, ShieldCheck } from "lucide-react";
import { useAskAssistant } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/money";
import { WorkspaceStatus } from "@/components/workspace-status";
import { QuickHelp } from "@/components/quick-help";
import { ASK_EVENT, modeFor, type AssistantMode } from "@/lib/ask";
import { assistantPrompts } from "@/lib/personalize";
import { usePrefs } from "@/hooks/use-personalization";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/portfolio", label: "Holdings", icon: Layers },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/resources", label: "Resources", icon: Library },
  { href: "/thesis", label: "Thesis journal", icon: NotebookPen },
  { href: "/wealth", label: "Wealth sketch", icon: Sprout },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Mark() {
  return (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground"><Compass className="h-4 w-4" /></span>
      <span className="font-display text-2xl text-sidebar-foreground">Portfolio<span className="italic text-sidebar-primary">IQ</span></span>
    </Link>
  );
}

function NavList({ onNav }: { onNav?: () => void }) {
  const [loc] = useLocation();
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? loc === "/" : loc.startsWith(href);
        return (
          <Link key={href} href={href} onClick={onNav} aria-current={active ? "page" : undefined} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
            className={cn("group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50")}>
            {active && <span className="absolute -left-1 top-2 bottom-2 w-[3px] rounded-full bg-sidebar-primary" />}
            <Icon className="h-4 w-4" />{label}
          </Link>
        );
      })}
    </nav>
  );
}

function Assistant({ open, onOpenChange, mode, draft }: { open: boolean; onOpenChange: (o: boolean) => void; mode: AssistantMode; draft: { text: string; n: number } | null }) {
  const ask = useAskAssistant();
  const { prefs } = usePrefs();
  const [q, setQ] = useState("");
  const [include, setInclude] = useState(false);
  const [log, setLog] = useState<{ q: string; a: string; withPortfolio: boolean; mode: AssistantMode }[]>([]);
  const questionRef = useRef(q);
  questionRef.current = q;
  const lastDraft = useRef(0);
  useEffect(() => {
    if (!draft || draft.n === lastDraft.current) return;
    lastDraft.current = draft.n;
    if (questionRef.current.trim() && questionRef.current !== draft.text
      && !window.confirm("Replace your unsent question with this suggested question?")) return;
    setQ(draft.text);
  }, [draft]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const question = q.trim();
    if (!question || ask.isPending) return;
    ask.mutate({ data: { question, includePortfolio: include, mode } }, {
      onSuccess: (r) => {
        setLog((l) => [...l, { q: question, a: r.answer, withPortfolio: include, mode }]);
        setQ((current) => current.trim() === question ? "" : current);
      },
    });
  };
  // Suggestions come from saved answers locally; only the question you Send is transmitted.
  const prompts = assistantPrompts(mode, prefs);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5 text-left">
          <p className="eyebrow" data-testid="text-assistant-mode">{mode} · Ask a question</p>
          <SheetTitle className="font-display text-3xl font-normal">Think it through</SheetTitle>
          <SheetDescription>Educational answers, not advice. Your question is sent to OpenAI through Replit only when you press Send. Budget and journal records are never sent.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
          {log.length === 0 && !ask.isPending && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Suggestions fill the box as a draft. Nothing is sent until you press Send:</p>
              {prompts.map((p) => (
                <button key={p} onClick={() => { if (questionRef.current.trim() && questionRef.current !== p && !window.confirm("Replace your unsent question with this suggestion?")) return; setQ(p); }} className="block w-full rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-accent" data-testid={`button-prompt-${p.length}`}>{p}</button>
              ))}
            </div>
          )}
          {log.map((m, i) => (
            <div key={i} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{m.q}</p>
              <div className="paper whitespace-pre-wrap p-4 text-[14px] leading-relaxed" data-testid={`text-answer-${i}`}>
                <p className="eyebrow mb-2">{m.mode}{m.withPortfolio ? " · Used your holdings" : " · No saved records shared"}</p>
                {m.a}
              </div>
            </div>
          ))}
          {ask.isPending && <div className="paper animate-pulse p-4 text-sm text-muted-foreground" role="status">Thinking through your question…</div>}
          {ask.isError && <p role="alert" className="text-sm text-destructive">{errMsg(ask.error)}</p>}
        </div>
        <form onSubmit={submit} className="space-y-3 border-t bg-card p-4">
          <Textarea aria-label="Your question" value={q} onChange={(e) => setQ(e.target.value)} maxLength={2000} placeholder={`Ask a ${mode.toLowerCase()} question…`} className="min-h-[80px] resize-none bg-background" data-testid="input-question"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }} />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Switch checked={include} onCheckedChange={setInclude} data-testid="switch-include-portfolio" aria-label="Include my portfolio" />
              <span><span className="font-medium text-foreground">Include my holdings</span><br />Off by default. Adds up to 100 holdings, your experience and goal for this question.</span>
            </label>
            <Button type="submit" disabled={!q.trim() || ask.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-send"><Send className="mr-1.5 h-4 w-4" />Send</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [askOpen, setAskOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [draft, setDraft] = useState<{ text: string; n: number } | null>(null);
  const [location] = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousLocation = useRef(location);
  const mode = modeFor(location);
  useEffect(() => {
    const onAsk = (event: Event) => {
      const text = (event as CustomEvent<unknown>).detail;
      if (typeof text !== "string" || !text.trim()) return;
      setDraft((previous) => ({ text: text.slice(0, 2000), n: (previous?.n ?? 0) + 1 }));
      setMenuOpen(false);
      setAskOpen(true);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);
  useEffect(() => {
    if (previousLocation.current !== location) {
      previousLocation.current = location;
      main.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location]);
  const footer = (
    <div className="space-y-3">
      <button onClick={() => { setMenuOpen(false); setHelpOpen(true); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent" data-testid="button-open-help">
        <CircleHelp className="h-4 w-4" />Help &amp; quick guide
      </button>
      <button onClick={() => { setMenuOpen(false); setAskOpen(true); }} className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2.5 text-sm text-sidebar-foreground hover:border-sidebar-primary" data-testid="button-open-assistant">
        <MessageCircle className="h-4 w-4 text-sidebar-primary" />Ask a question
        <span className="num ml-auto text-[10px] text-sidebar-foreground/65" data-testid="text-assistant-nav-mode">{mode}</span>
      </button>
      <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-start gap-2 rounded-lg bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/75" data-testid="link-saving-info">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
        <span>Saved on our server, remembered by this browser. No account needed.</span>
      </Link>
    </div>
  );
  return (
    <div className="min-h-[100dvh] md:flex">
      <a href="#main-content" className="sr-only fixed left-3 top-3 z-[100] rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only">Skip to main content</a>
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col justify-between bg-sidebar p-4 md:flex">
        <div className="space-y-8"><div className="px-2 pt-1"><Mark /></div><NavList /></div>
        {footer}
      </aside>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <Mark />
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="text-sidebar-foreground" onClick={() => setHelpOpen(true)} aria-label="Help and quick guide"><CircleHelp className="h-5 w-5" /></Button>
          <Button size="icon" variant="ghost" className="text-sidebar-foreground" onClick={() => setAskOpen(true)} aria-label="Ask a question"><MessageCircle className="h-5 w-5" /></Button>
          <Button size="icon" variant="ghost" className="text-sidebar-foreground" onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="button-menu"><Menu className="h-5 w-5" /></Button>
        </div>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col justify-between border-none bg-sidebar p-4">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="space-y-8"><div className="px-2 pt-1"><Mark /></div><NavList onNav={() => setMenuOpen(false)} /></div>
          {footer}
        </SheetContent>
      </Sheet>
      <main id="main-content" ref={main} tabIndex={-1} className="min-w-0 flex-1 px-5 py-8 outline-none md:px-12 md:py-10"><div className="mx-auto max-w-5xl"><WorkspaceStatus />{children}</div></main>
      <Assistant open={askOpen} onOpenChange={setAskOpen} mode={mode} draft={draft} />
      <QuickHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
