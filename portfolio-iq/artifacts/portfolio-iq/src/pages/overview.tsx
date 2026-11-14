import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Eye, ImageUp, Info, Plus, Sparkles, AlertCircle, CheckCircle2, NotebookPen, Layers, BookOpen } from "lucide-react";
import { useGetOverview, useGetWorkspace, useLoadSampleData } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/kit";
import { HoldingDialog } from "@/components/holding-dialog";
import { ImageImportDialog } from "@/components/image-import/image-import-dialog";
import { useToast } from "@/hooks/use-toast";
import { errMsg, money, pct, TYPE_COLORS, useRefreshWorkspace } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PersonalPlan } from "@/components/personal-plan";
import { usePrefs } from "@/hooks/use-personalization";
import { dashboardPlan, type Section } from "@/lib/personalize";

function Donut({ parts }: { parts: { type: string; percent: number }[] }) {
  let acc = 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90" role="img" aria-label="Allocation by type">
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" />
      {parts.map((p) => {
        const len = (p.percent / 100) * c;
        const el = <circle key={p.type} cx="50" cy="50" r={r} fill="none" stroke={TYPE_COLORS[p.type] ?? TYPE_COLORS.Other} strokeWidth="12" strokeDasharray={`${Math.max(len - 1, 0)} ${c}`} strokeDashoffset={-acc} />;
        acc += len;
        return el;
      })}
    </svg>
  );
}

const toneStyle = { caution: { bar: "border-l-accent", icon: AlertCircle, color: "text-accent" }, positive: { bar: "border-l-chart-2", icon: CheckCircle2, color: "text-chart-2" }, info: { bar: "border-l-chart-4", icon: Info, color: "text-chart-4" } };

export default function Overview() {
  const ws = useGetWorkspace();
  const ov = useGetOverview();
  const sample = useLoadSampleData();
  const refresh = useRefreshWorkspace();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const name = ws.data?.name?.trim();
  const { prefs } = usePrefs();
  const plan = dashboardPlan(prefs);

  if (ov.isLoading) return <LoadingBlock />;
  if (ov.isError || !ov.data) return <ErrorBlock message={errMsg(ov.error)} onRetry={() => ov.refetch()} />;
  const o = ov.data;
  const theses = [...(ws.data?.theses ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  const loadSample = () => sample.mutate(undefined, {
    onSuccess: () => { refresh(); toast({ title: "Sample portfolio loaded", description: "Every sample is labelled. Edit or delete any of them." }); },
    onError: (e) => toast({ title: "Couldn't load samples", description: errMsg(e), variant: "destructive" }),
  });

  if (o.holdingCount === 0) {
    return (
      <div>
        <p className="eyebrow rise">{date}</p>
        <h1 className="rise rise-1 mt-3 font-display text-5xl leading-[1.02] md:text-7xl">{name ? `Welcome, ${name}.` : "A quiet place"}<br /><span className="italic text-accent">{name ? "Start with what you own." : "for what you own."}</span></h1>
        <p className="rise rise-2 mt-5 max-w-lg text-[16px] text-muted-foreground">Import a screenshot of your brokerage positions, or write holdings down by hand. We'll show where your money sits, point out things worth noticing, and help you think before you trade.</p>
        <div className="rise rise-3 mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => setImporting(true)} data-testid="button-import-first-screenshot"><ImageUp className="mr-2 h-4 w-4" />Import a screenshot</Button>
          <Button size="lg" variant="outline" onClick={() => setAdding(true)} data-testid="button-add-first-holding"><Plus className="mr-2 h-4 w-4" />Add by hand</Button>
          <Button size="lg" variant="outline" onClick={loadSample} disabled={sample.isPending} data-testid="button-load-sample"><Eye className="mr-2 h-4 w-4" />{sample.isPending ? "Loading..." : "Explore sample portfolio"}</Button>
        </div>
        <p className="rise rise-3 mt-3 text-xs text-muted-foreground">Samples are illustrative, clearly labelled, and fully editable. Nothing is added unless you ask.</p>
        <div className="mt-10"><PersonalPlan prefs={prefs} /></div>
        <div className="rise rise-4 mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
          {[
            { icon: Layers, n: "01", t: "Record", d: "Import a positions screenshot or type it in. Total paid is optional.", href: "/portfolio" },
            { icon: NotebookPen, n: "02", t: "Reason", d: "Write a thesis before you buy. Note the risks out loud.", href: "/thesis" },
            { icon: BookOpen, n: "03", t: "Learn", d: "Short lessons with one question each. Progress is saved.", href: "/learn" },
          ].map((s) => (
            <Link key={s.n} href={s.href} className="group bg-card p-6 transition-colors hover:bg-secondary/60" data-testid={`link-step-${s.n}`}>
              <div className="flex items-center justify-between"><span className="num text-xs text-muted-foreground">{s.n}</span><s.icon className="h-4 w-4 text-accent" /></div>
              <p className="mt-6 font-display text-3xl">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </Link>
          ))}
        </div>
        <HoldingDialog open={adding} onOpenChange={setAdding} />
        <ImageImportDialog open={importing} onOpenChange={setImporting} kind="holdings" />
      </div>
    );
  }

  const gainPos = (o.gainCents ?? 0) >= 0;
  const blocks: Record<"allocation" | "insights" | "thesis", ReactNode> = {
    allocation: (
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="rise rise-2 relative overflow-hidden rounded-[1.1rem] bg-primary p-7 text-primary-foreground">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
          <p className="num text-[10.5px] tracking-[.18em] text-primary-foreground/60">SNAPSHOT VALUE{o.hasSampleData ? " · INCLUDES SAMPLES" : ""}</p>
          <p className="num mt-3 text-4xl md:text-5xl" data-testid="text-total-value">{money(o.totalValueCents)}</p>
          <dl className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div><dt className="text-[11px] text-primary-foreground/55">Unrealized change</dt><dd className={cn("num mt-1", o.gainCents == null ? "" : gainPos ? "text-[hsl(160_45%_62%)]" : "text-[hsl(10_80%_70%)]")} data-testid="text-gain">{o.gainCents == null ? "Unknown" : `${gainPos ? "+" : ""}${money(o.gainCents)}`}{o.gainPercent != null && <span className="ml-1 text-xs opacity-75">({pct(o.gainPercent, 2)})</span>}</dd></div>
            <div><dt className="text-[11px] text-primary-foreground/55">Paid in total</dt><dd className="num mt-1">{o.knownCostCount ? money(o.totalCostBasisCents) : "Unknown"}</dd></div>
            <div><dt className="text-[11px] text-primary-foreground/55">Cash</dt><dd className="num mt-1">{money(o.cashValueCents)}</dd></div>
            <div><dt className="text-[11px] text-primary-foreground/55">Holdings</dt><dd className="num mt-1">{o.holdingCount}</dd></div>
          </dl>
          <p className="mt-6 flex items-start gap-2 text-xs text-primary-foreground/55"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Based on prices you entered{o.lastPriceDate ? `, latest ${o.lastPriceDate}` : ""}. Cost known for {o.knownCostCount} of {o.holdingCount}. Not live quotes.</p>
        </section>

        <section className="paper rise rise-3 p-6">
          <p className="eyebrow !text-muted-foreground">Where it sits</p>
          <div className="mt-4 flex items-center gap-6">
            <Donut parts={o.allocation} />
            <ul className="flex-1 space-y-2">
              {o.allocation.map((a) => (
                <li key={a.type} className="flex items-center justify-between text-sm" data-testid={`row-allocation-${a.type}`}>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[a.type] ?? TYPE_COLORS.Other }} />{a.type}</span>
                  <span className="num text-muted-foreground">{pct(a.percent)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 space-y-1.5">
            {o.allocation.map((a) => (
              <div key={a.type} className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${a.percent}%`, background: TYPE_COLORS[a.type] ?? TYPE_COLORS.Other }} /></div>
            ))}
          </div>
        </section>
      </div>

    ),
    insights: (
      <div>
      <h2 className="mb-4 font-display text-3xl">Things worth noticing</h2>
      {o.insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing stands out right now. That's often a good sign.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {o.insights.map((ins, i) => {
            const t = toneStyle[ins.tone] ?? toneStyle.info;
            return (
              <article key={i} className={cn("paper border-l-[3px] p-5", t.bar)} data-testid={`card-insight-${i}`}>
                <p className="flex items-center gap-2 font-medium"><t.icon className={cn("h-4 w-4", t.color)} />{ins.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{ins.description}</p>
              </article>
            );
          })}
        </div>
      )}

      </div>
    ),
    thesis: (
      <div className="grid gap-5 md:grid-cols-[1fr_1.3fr]">
        <aside className="rounded-[1.1rem] bg-chart-2/10 p-6">
          <p className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-chart-2" />Snapshots, not live quotes</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Every number here comes from a price you entered or confirmed from a screenshot. Refresh them before you make a decision, and treat change as unrealized: nothing is gained or lost until you sell.</p>
        </aside>
        <section className="paper p-6">
          <div className="flex items-center justify-between"><p className="font-medium">From your thesis journal</p><Link href="/thesis" className="flex items-center gap-1 text-sm text-accent" data-testid="link-thesis-journal">Open<ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
          {theses.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No theses yet. Before your next trade, write down why in two sentences.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {theses.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm" data-testid={`row-recent-thesis-${t.id}`}>
                  {t.symbol && <span className="num rounded bg-secondary px-1.5 py-0.5 text-xs">{t.symbol}</span>}
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    ),
  };
  return (
    <div>
      {o.hasSampleData && (
        <div className="rise mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-chart-4/50 bg-chart-4/10 px-4 py-2.5 text-sm" data-testid="banner-sample">
          <span className="num rounded bg-primary px-1.5 py-0.5 text-[10px] tracking-widest text-primary-foreground">SAMPLE DATA</span>
          <span className="flex-1">Some holdings are illustrative samples. Edit or delete them any time.</span>
          <Link href="/portfolio" className="font-medium underline underline-offset-4" data-testid="link-manage-samples">Manage holdings</Link>
        </div>
      )}
      <p className="eyebrow rise">{date}</p>
      <h1 className="rise rise-1 mt-2 mb-8 font-display text-5xl md:text-6xl">A quiet look at what you own.</h1>

      <PersonalPlan prefs={prefs} />
      <div className="space-y-10">
        {plan.order.filter((sec): sec is Exclude<Section, "learn" | "wealth"> => sec in blocks).map((sec) => <div key={sec} data-testid={`section-${sec}`}>{blocks[sec]}</div>)}
      </div>
    </div>
  );
}
