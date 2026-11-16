import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { AlertTriangle, ExternalLink, RotateCw } from "lucide-react";
import type { Source } from "@workspace/api-client-react";

const markdownParser = unified().use(remarkParse).use(remarkGfm);

function normalizeMathDelimiters(markdown: string): string {
  const normalize = (text: string) => text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `\n$$\n${math}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math: string) => `$${math}$`);
  // Source offsets preserve code verbatim, including nested, longer, tilde,
  // and unfinished fences. Do not reserialize Markdown or match across code.
  const tree = markdownParser.parse(markdown);
  let cursor = 0;
  let content = "";
  function visit(node: typeof tree | (typeof tree.children)[number]) {
    if (node.type === "code" || node.type === "inlineCode") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) {
        content += normalize(markdown.slice(cursor, start)) + markdown.slice(start, end);
        cursor = end;
      }
    } else if ("children" in node) {
      node.children.forEach(visit);
    }
  }
  visit(tree);
  return content + normalize(markdown.slice(cursor));
}

export function Markdown({ children }: { children: string }) {
  const content = normalizeMathDelimiters(children);
  return (
    <div className="prose prose-slate max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/85 prose-li:text-foreground/85 prose-strong:text-foreground prose-a:text-accent-ink prose-code:font-mono prose-code:text-[0.85em] prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-th:text-foreground prose-td:text-foreground/85">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink flex items-center gap-2">
      <span className="h-px w-6 bg-accent" />
      {children}
    </div>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="rise mb-8 md:mb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-3 leading-[1.02]">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted-foreground text-[15px] leading-relaxed">{children}</div>}
    </header>
  );
}

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources?.length) return <p className="text-xs font-mono text-muted-foreground">No sources attached.</p>;
  return (
    <ul className="space-y-2">
      {sources.map((s, i) => (
        <li key={s.url + i}>
          <a href={s.url} target="_blank" rel="noreferrer" data-testid={`link-source-${i}`}
            className="group flex flex-col sm:flex-row items-start gap-3 rounded-md border bg-card p-3 hover:border-accent transition-colors">
            <span className="font-mono text-[10px] uppercase tracking-wider rounded bg-secondary px-1.5 py-0.5 mt-0.5 shrink-0">{s.kind}</span>
            <span className="flex-1 min-w-0 max-w-full">
              <span className="block text-sm font-medium group-hover:text-accent-ink">{s.title}</span>
              <span className="block text-xs text-muted-foreground font-mono truncate">{s.url}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">Checked {fmtDate(s.checkedAt)}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function fmtDate(d: string) {
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function ErrorState({ title = "Something did not load", onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">The server may be restarting. Your saved data is not lost.</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} data-testid="button-retry" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:border-accent">
          <RotateCw className="h-4 w-4" /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed grid-paper p-8 md:p-12 text-center">
      <svg viewBox="0 0 120 24" className="mx-auto h-6 w-28 text-accent-ink" aria-hidden>
        <path d="M0 12h30l5-8 10 16 10-16 10 16 5-8h50" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="font-display text-xl font-semibold mt-4">{title}</p>
      {children && <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Pilot membership badge. Driven only by `isPilot`, never by the legacy `coverage` field. */
export function CoverageTag({ isPilot }: { isPilot: boolean }) {
  return isPilot ? (
    <span className="font-mono text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-accent text-accent-foreground" data-testid="tag-pilot">Pilot workspace</span>
  ) : (
    <span className="font-mono text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border text-muted-foreground" data-testid="tag-catalog">Catalog only</span>
  );
}

/** Independent indicator of what instructional content exists, from `instructionalCoverage`. */
export function InstructionalTag({ value }: { value: string }) {
  if (!value) return null;
  return (
    <span className="font-mono text-[10px] tracking-wider rounded px-1.5 py-0.5 bg-secondary text-foreground/80" title="Instructional coverage" data-testid="tag-instructional">{value}</span>
  );
}

export const btn = "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-[transform,opacity] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
export const btnPrimary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
export const btnAccent = `${btn} bg-accent text-accent-foreground hover:opacity-90`;
export const btnGhost = `${btn} border bg-card hover:border-accent`;
