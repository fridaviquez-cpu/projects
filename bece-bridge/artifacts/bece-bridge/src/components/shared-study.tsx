import { useGetSharedStudy } from "@workspace/api-client-react";
import { ErrorState, Skel } from "./kit";

export function hasSharedStudy(id: string): id is Parameters<typeof useGetSharedStudy>[0] {
  return ["110", "120", "210", "220"].includes(id);
}

export function SharedStudy({ courseId }: { courseId: Parameters<typeof useGetSharedStudy>[0] }) {
  const query = useGetSharedStudy(courseId);
  if (query.isLoading) return <Skel className="h-32" />;
  if (query.isError) return <ErrorState title="Could not load shared study coverage" onRetry={() => query.refetch()} />;
  if (!query.data) return null;
  return <section className="mt-8 rounded-lg border bg-card p-5" data-testid="shared-study">
    <h2 className="font-display text-xl font-semibold">Shared study material</h2>
    <p className="text-sm text-muted-foreground mt-2">
      Licensed instructional selections, not official UIUC lectures. Each topic below is only partially covered.
      Studio retrieves matching selections by topic; unmatched requests remain general AI explanations.
      Source permission and citation checks do not verify generated answers.
    </p>
    <div className="mt-4 space-y-3">
      {query.data.entries.map(s => <details key={s.id} className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">{s.title} — {s.locator.split(": ").slice(1).join(": ")}</summary>
        <p className="text-xs text-muted-foreground mt-2">Partial coverage: {s.topics.join("; ")}</p>
        <blockquote className="my-3 whitespace-pre-wrap border-l-2 border-accent pl-3 text-sm">{s.text}</blockquote>
        <p className="text-xs text-muted-foreground">Changes and limits: {s.changes}</p>
        <p className="text-xs mt-3">{s.attribution} · <a className="text-accent underline" href={s.licenseUrl} target="_blank" rel="noreferrer">{s.license}</a> · Checked {s.checkedAt.slice(0,10)}</p>
        <div className="flex flex-wrap gap-3 text-xs mt-2">
          <a className="text-accent underline" href={s.url} target="_blank" rel="noreferrer">Source page and authors</a>
          <a className="text-accent underline" href={s.revisionUrl} target="_blank" rel="noreferrer">Version consulted</a>
          <a className="text-accent underline" href={s.permissionUrl} target="_blank" rel="noreferrer">Reuse permission</a>
        </div>
      </details>)}
    </div>
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer">No shared selection yet: {query.data.uncoveredTopics.length} other scope topics</summary>
      <ul className="list-disc pl-5 mt-2 text-muted-foreground">{query.data.uncoveredTopics.map(t=><li key={t}>{t}</li>)}</ul>
      <p className="mt-2 text-xs">A gap here does not mean a topic is outside the university course.</p>
    </details>
  </section>;
}
