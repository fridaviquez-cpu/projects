import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BookOpenText, ListTree } from "lucide-react";
import type { Resource } from "@workspace/api-client-react";
import { Markdown, Sources, fmtDate } from "@/components/kit";
import { ReportForm } from "@/components/reports";
import { TutorConversation } from "@/components/tutor-conversation";

type Head = { id: string; text: string; level: number };

/** Shared reading surface for a generated resource: outline, focus mode, sources, report form. */
export function ResourceWorkspace({ resource, toolbar, after }: { resource: Resource; toolbar?: ReactNode; after?: ReactNode }) {
  const uid = useId().replace(/:/g, "");
  const body = useRef<HTMLDivElement>(null);
  const [heads, setHeads] = useState<Head[]>([]);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const found: Head[] = [];
    el.querySelectorAll<HTMLElement>("h1, h2, h3, h4").forEach((h, i) => {
      h.id = `${uid}-s${i}`;
      h.tabIndex = -1;
      h.classList.add("scroll-mt-24");
      found.push({ id: h.id, text: h.textContent?.trim() || `Section ${i + 1}`, level: Number(h.tagName[1]) });
    });
    setHeads(found);
  }, [resource.id, resource.content, uid]);

  const jump = (id: string) => {
    const h = document.getElementById(id);
    if (!h) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    h.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    h.focus({ preventScroll: true });
  };
  const minLevel = heads.length ? Math.min(...heads.map((h) => h.level)) : 2;
  const showOutline = heads.length >= 2 && !focus;

  return (
    <article className="rise min-w-0 break-words rounded-lg border bg-card p-5 md:p-8" aria-labelledby={`${uid}-title`} data-testid="resource-workspace">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {toolbar}
        <button type="button" aria-pressed={focus} onClick={() => setFocus((f) => !f)} data-testid="button-focus-reading"
          className={`ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${focus ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-accent"}`}>
          <BookOpenText className="h-3.5 w-3.5" aria-hidden /> {focus ? "Exit focus reading" : "Focus reading"}
        </button>
      </div>
      <p className="font-mono text-xs text-accent-ink">{resource.kind}{resource.courseId ? ` · ECE ${resource.courseId}` : ""} · {fmtDate(resource.createdAt)}{resource.materialIds?.length ? ` · from ${resource.materialIds.length} of your materials` : ""}</p>
      <h2 id={`${uid}-title`} className="font-display text-2xl md:text-3xl font-extrabold mt-1">{resource.title}</h2>
      <p className="text-xs rounded bg-accent/10 p-3 my-5 border-l-2 border-accent" data-testid="text-disclaimer">{resource.disclaimer}</p>

      <div className={showOutline ? "xl:grid xl:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] xl:gap-6" : ""}>
        {showOutline && (
          <nav aria-label="Sections in this resource" className="mb-6 lg:mb-0">
            <div className="lg:sticky lg:top-24 rounded-md border bg-background/70 p-3">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2"><ListTree className="h-3.5 w-3.5" aria-hidden /> On this page</p>
              <ol className="space-y-0.5 max-h-60 lg:max-h-[60vh] overflow-auto">
                {heads.map((h) => (
                  <li key={h.id} style={{ paddingLeft: `${(h.level - minLevel) * 0.75}rem` }}>
                    <button type="button" onClick={() => jump(h.id)} data-testid={`button-jump-${h.id}`}
                      className="w-full text-left rounded px-1.5 py-1 text-xs leading-snug hover:bg-muted hover:text-foreground text-foreground/80">{h.text}</button>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        )}
        <div ref={body} className={`min-w-0 transition-[max-width] ${focus ? "max-w-[68ch] mx-auto text-[1.05rem]" : ""}`}>
          <Markdown>{resource.content}</Markdown>
        </div>
      </div>

      <h3 className="font-display font-semibold mt-8 mb-3">Sources</h3>
      <Sources sources={resource.sources} />
      {after}
      <TutorConversation resource={resource} />
      <ReportForm resourceId={resource.id} resourceTitle={resource.title} />
    </article>
  );
}
