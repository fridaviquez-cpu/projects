import { useMemo, useState } from "react";
import { usePrefs } from "@/hooks/use-personalization";
import { ArrowRight } from "lucide-react";
import { Bookmark, BookmarkCheck, ExternalLink, Library, MessageCircle } from "lucide-react";
import { useGetLearningTopics } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/kit";
import { errMsg } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useToggleBookmark } from "@/pages/learn";
import { askAbout } from "@/lib/ask";

function Chips({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      {["All", ...values].map((v) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v} data-testid={`button-${label.toLowerCase()}-${v}`} className={cn("rounded-full border px-3 py-1 text-xs", value === v ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>{v}</button>
      ))}
    </div>
  );
}

export default function Resources() {
  const q = useGetLearningTopics();
  const toggle = useToggleBookmark();
  const [track, setTrack] = useState("All");
  const [evidence, setEvidence] = useState("All");
  const [saved, setSaved] = useState(false);
  const topics = useMemo(() => q.data ?? [], [q.data]);
  const tracks = useMemo(() => Array.from(new Set(topics.map((t) => t.track))), [topics]);
  const evid = useMemo(() => Array.from(new Set(topics.map((t) => t.evidence))), [topics]);
  const { prefs } = usePrefs();
  const level = prefs?.experience === "experienced" ? "Advanced" : prefs?.experience === "regular" ? "Intermediate" : "Beginner";
  const suggested = topics.find((t) => t.level === level && !t.completed) ?? topics.find((t) => t.level === level) ?? null;
  const goTo = (id: string) => {
    setTrack("All"); setEvidence("All"); setSaved(false);
    requestAnimationFrame(() => { const el = document.getElementById(`resource-${id}`); el?.scrollIntoView({ block: "center" }); el?.focus({ preventScroll: true }); });
  };
  const list = topics.filter((t) => (track === "All" || t.track === track) && (evidence === "All" || t.evidence === evidence) && (!saved || t.bookmarked));
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader eyebrow="Resources" title="Reading worth your time." lede="Primary sources from regulators, researchers and investor-education groups, sorted by how strong the evidence is." />
      {suggested && (
        <div className="paper rise mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="panel-suggested-next">
          <div><p className="eyebrow">Suggested next · {level}{prefs?.experience ? "" : " (default)"}</p><p className="mt-1 font-medium">{suggested.title}</p><p className="text-xs text-muted-foreground">Picked for your experience level. Every other topic stays listed below.</p></div>
          <Button size="sm" variant="outline" onClick={() => goTo(suggested.id)} data-testid="button-goto-suggested">Jump to it<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
        </div>
      )}
      <div className="mb-6 space-y-3">
        <Chips label="Topic" values={tracks} value={track} onChange={setTrack} />
        <Chips label="Evidence" values={evid} value={evidence} onChange={setEvidence} />
        <Button size="sm" variant={saved ? "default" : "outline"} onClick={() => setSaved(!saved)} aria-pressed={saved} data-testid="button-filter-bookmarked"><BookmarkCheck className="mr-1.5 h-3.5 w-3.5" />Bookmarked only</Button>
      </div>
      {list.length === 0 ? <EmptyState icon={<Library className="h-5 w-5" />} title={saved ? "No bookmarks yet" : "Nothing matches"} body={saved ? "Save a topic and it will wait for you here." : "Loosen a filter to see more."} /> : (
        <div className="columns-1 gap-4 md:columns-2 [&>*]:mb-4">
          {list.map((t) => (
            <article key={t.id} id={`resource-${t.id}`} tabIndex={-1} className="paper break-inside-avoid p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`card-resource-${t.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="eyebrow">{t.track}</p><h3 className="mt-1 font-display text-2xl leading-tight">{t.title}</h3></div>
                <Button size="icon" variant="ghost" onClick={() => toggle(t)} aria-label={t.bookmarked ? "Remove bookmark" : "Bookmark"} aria-pressed={t.bookmarked} data-testid={`button-bookmark-${t.id}`}>{t.bookmarked ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}</Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              <p className="mt-3 inline-block rounded bg-secondary px-2 py-0.5 text-xs">Evidence: {t.evidence}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {t.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-accent hover:underline">{s.title}<ExternalLink className="h-3 w-3" /></a> <span className="text-xs text-muted-foreground">{s.publisher}</span></li>)}
              </ul>
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => askAbout(`Help me understand "${t.title}". Explain the core idea, the main risk, and how to evaluate the evidence without recommending an investment.`)} data-testid={`button-ask-resource-${t.id}`}><MessageCircle className="mr-1.5 h-3.5 w-3.5" />Ask about this</Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
