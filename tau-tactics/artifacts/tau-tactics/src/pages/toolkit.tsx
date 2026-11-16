import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Search } from "lucide-react";
import { resources, TAU_SITE, TOOLKIT_DRIVE } from "@/lib/content";
import { KEYS, useLocal } from "@/lib/store";
import { btn, CopyButton, DeviceNote, PageHeader } from "@/components/shell";
import { cn } from "@/lib/utils";

const cats = ["All", "Saved", "AI Tools", "Apps & Extensions", "Videos & Channels", "Books", "Prompt Library"] as const;

export default function Toolkit() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const [favs, setFavs] = useLocal<string[]>(KEYS.favorites, []);
  const list = useMemo(() => resources.filter((r) =>
    (cat === "All" || (cat === "Saved" ? favs.includes(r.id) : r.cat === cat)) &&
    (r.name + r.desc + r.kind).toLowerCase().includes(q.toLowerCase())), [q, cat, favs]);
  const toggle = (id: string) => setFavs(favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]);

  return (
    <div>
      <PageHeader kicker="08 · Leave with something" title={<>The Student <em>Toolkit.</em></>}>
        No gatekeeping. No paywalls. Tools that work, curated by the brothers of the Tau Chapter of Alpha Phi Alpha Fraternity, Inc.
      </PageHeader>

      <div className="sticky top-14 z-20 -mx-4 bg-background/90 px-4 py-3 backdrop-blur md:top-0">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools, books, prompts" aria-label="Search toolkit"
            className="w-full rounded-full border border-input bg-card py-2.5 pl-10 pr-4 text-sm focus:border-[var(--gold)] focus:outline-none" data-testid="input-search" />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} data-testid={`button-cat-${c.toLowerCase().replace(/\W+/g, "-")}`}
              className={cn("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95", cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-[var(--gold)]")}>
              {c}{c === "Saved" && ` (${favs.filter((f) => resources.some((r) => r.id === f)).length})`}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-xl italic">{cat === "Saved" && !q ? "Nothing bookmarked yet." : "No matches."}</p>
          <p className="mt-1 text-sm text-muted-foreground">{cat === "Saved" ? "Use the bookmark icon on any resource to keep it here." : "Try a different word or category."}</p>
          <button onClick={() => { setQ(""); setCat("All"); }} className={`${btn.ghost} mt-4`} data-testid="button-reset-filters">Show everything</button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => {
            const fav = favs.includes(r.id);
            return (
              <li key={r.id} className={cn("lift flex flex-col rounded-2xl border p-5", r.prompt ? "ink-panel border-transparent" : "border-border bg-card")} data-testid={`card-resource-${r.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{r.kind}</span>
                  <button onClick={() => toggle(r.id)} aria-pressed={fav} aria-label={fav ? `Remove ${r.name} bookmark` : `Bookmark ${r.name}`} data-testid={`button-bookmark-${r.id}`} className="icon-action hover:bg-secondary">
                    {fav ? <BookmarkCheck className="h-4 w-4 text-gold" /> : <Bookmark className="h-4 w-4" />}
                  </button>
                </div>
                <p className="font-display mt-2 text-lg font-semibold leading-tight">{r.name}</p>
                <p className={cn("mt-1 flex-1 text-sm", r.prompt ? "text-[var(--paper)]/70" : "text-muted-foreground")}>{r.desc}</p>
                <div className="mt-4">
                  {r.prompt ? <CopyButton text={r.prompt} testId={`button-copy-${r.id}`} label="Copy prompt" className="border-white/20 bg-transparent text-[var(--paper)]" />
                    : <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline decoration-[var(--gold)] underline-offset-4" data-testid={`link-resource-${r.id}`}>Open <ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3"><DeviceNote>Bookmarks are saved on this device only.</DeviceNote></div>

      <section className="ink-panel mt-12 grid gap-6 rounded-3xl p-7 sm:p-10 md:grid-cols-[1.5fr_1fr] md:items-center">
        <div>
          <h2 className="font-display text-3xl font-semibold">The full Student Toolkit, <em className="text-[var(--gold)]">free.</em></h2>
          <p className="mt-3 text-[var(--paper)]/70">Whether you're an EE student hunting for circuit simulators, a STEM major looking for study tools, or figuring out focus, resumes, and well-being, there's something in it for you. Study skills, AI tools, career development, faith, and more.</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <a href={TOOLKIT_DRIVE} target="_blank" rel="noreferrer" className={btn.gold} data-testid="link-open-toolkit">Open the Toolkit <ExternalLink className="h-4 w-4" /></a>
          <a href={TAU_SITE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--gold-soft)] underline underline-offset-4" data-testid="link-tau-site">Visit the original Tau Tactics site <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </section>
    </div>
  );
}
