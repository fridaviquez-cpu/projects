import { useState } from "react";
import { ChevronDown, RotateCw, Scissors } from "lucide-react";
import { loop, myths, scienceCards, stats, tactics } from "@/lib/content";
import { PageHeader } from "@/components/shell";
import { cn } from "@/lib/utils";

export default function Learn() {
  const [open, setOpen] = useState<string | null>(tactics[0].id);
  const [flipped, setFlipped] = useState<number[]>([]);

  return (
    <div>
      <PageHeader kicker="01 · The science" title={<>Focus isn't a trait. It's a <em>trainable skill.</em></>}>
        The first step is understanding what constant stimulation does to attention. Findings below come from specific studies; treat them as useful evidence, not universal laws.
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="font-display text-5xl font-semibold">{s.n}<span className="ml-1 font-mono text-sm text-gold">{s.unit}</span></p>
            <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {scienceCards.map((c, i) => (
          <div key={c.title} className="border-l-2 border-[var(--gold)] pl-4">
            <p className="font-mono text-xs text-muted-foreground">0{i + 1}</p>
            <h3 className="font-display text-xl font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-secondary p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Distracted brain</p>
          <p className="mt-2 text-sm">Notifications, feeds, and fast rewards keep the brain in reactive mode. Attention scatters across a dozen inputs, and deep work never starts.</p>
        </div>
        <div className="ink-panel rounded-2xl p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Focused brain</p>
          <p className="mt-2 text-sm text-[var(--paper)]/80">Remove the competition and attention consolidates on one target. This is where real learning (encoding, connecting, retaining) happens.</p>
        </div>
      </div>

      <h2 className="font-display mt-12 text-2xl font-semibold">The loop, and where to break it</h2>
      <ol className="mt-4 flex flex-col gap-2 md:flex-row">
        {loop.map((l, i) => (
          <li key={l.step} className={cn("flex-1 rounded-xl border p-4", l.cut ? "border-[var(--gold)] bg-[var(--gold)]/15" : "border-border bg-card")}>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{l.cut ? <Scissors className="h-3 w-3" /> : `0${i + 1}`}</p>
            <p className="mt-1 font-medium">{l.step}</p>
            <p className="text-xs text-muted-foreground">{l.note}</p>
          </li>
        ))}
      </ol>

      <section className="mt-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">02 · The tactics</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">Strategies that <em>actually work.</em></h2>
        <p className="mt-2 text-muted-foreground">No hacks, no 5 a.m. cold plunges. Six research-informed tactics you can run tonight.</p>
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {tactics.map((t, i) => {
            const isOpen = open === t.id;
            return (
              <li key={t.id}>
                <button onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen} data-testid={`button-tactic-${t.id}`}
                  className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-secondary/60">
                  <span className="font-mono text-sm text-gold">0{i + 1}</span>
                  <span className="flex-1"><span className="font-display block text-lg font-semibold">{t.name}</span><span className="text-xs text-muted-foreground">{t.tag}</span></span>
                  <ChevronDown className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="rise grid gap-4 px-5 pb-6 sm:grid-cols-2 sm:pl-14">
                    <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">How to run it</p><p className="mt-1 text-sm leading-relaxed">{t.how}</p></div>
                    <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Why it works</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.why}</p></div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">06 · Myth vs fact</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">Things students say that <em>research disagrees with.</em></h2>
        <p className="mt-2 text-muted-foreground">Select a card to reveal what the studies found.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myths.map((m, i) => {
            const f = flipped.includes(i);
            return (
              <button key={i} onClick={() => setFlipped(f ? flipped.filter((x) => x !== i) : [...flipped, i])} aria-pressed={f} data-testid={`button-myth-${i}`}
                className={cn("lift flex min-h-[230px] flex-col rounded-2xl border p-5 text-left", f ? "ink-panel border-transparent" : "border-border bg-card")}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{f ? "Fact" : "Myth"}</p>
                {f ? (
                  <div key="f" className="rise flex flex-1 flex-col">
                    <p className="mt-2 text-sm leading-relaxed text-[var(--paper)]/85">{m.fact}</p>
                    <p className="mt-auto pt-3 font-mono text-[11px] text-[var(--gold-soft)]">{m.source}</p>
                  </div>
                ) : (
                  <div key="m" className="flex flex-1 flex-col">
                    <p className="font-display mt-2 text-2xl font-medium italic leading-snug">"{m.myth}"</p>
                    <p className="mt-auto flex items-center gap-1 pt-3 text-xs text-muted-foreground"><RotateCw className="h-3 w-3" /> reveal the fact</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
