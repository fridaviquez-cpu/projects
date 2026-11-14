import { Link } from "wouter";
import { ArrowUpRight, Compass } from "lucide-react";
import type { Preferences } from "@workspace/api-client-react";
import { dashboardPlan, hasAnswers, prefChips } from "@/lib/personalize";

/** Optional setup invite (status "new" only) plus next actions ordered by dashboardPlan. Never blocks the page. */
export function PersonalPlan({ prefs }: { prefs: Preferences | null }) {
  const plan = dashboardPlan(prefs);
  const chips = prefChips(prefs);
  const personalized = hasAnswers(prefs);
  return (
    <div className="rise rise-2 mb-8 space-y-3" data-testid="panel-personal-plan">
      {prefs?.status === "new" && (
        <div className="flex flex-col gap-3 rounded-[1.1rem] border border-accent/30 bg-accent/5 p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="banner-setup-invite">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Compass className="h-4 w-4" /></span>
            <div><p className="font-medium">Want explanations at your level?</p><p className="text-sm text-muted-foreground">Seven optional questions, about a minute. Skip any of them. Nothing connects to a brokerage.</p></div>
          </div>
          <Link href="/onboarding" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" data-testid="link-start-setup">Personalize<ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow !text-muted-foreground" data-testid="text-plan-focus">{personalized ? `Ordered for you · ${plan.focus}` : "Suggested next"}</p>
        {personalized && <p className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">{chips.map((c) => <span key={c} className="rounded-full border px-2 py-0.5">{c}</span>)}<Link href="/settings" className="underline underline-offset-4" data-testid="link-edit-answers">Edit answers</Link></p>}
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {plan.actions.map((a, i) => (
          <li key={a.id}>
            <Link href={a.href} className="paper group flex h-full flex-col p-4 transition-transform hover:-translate-y-0.5" data-testid={`link-action-${a.id}`}>
              <span className="num text-[10.5px] text-muted-foreground">0{i + 1}</span>
              <span className="mt-2 font-medium">{a.title}</span>
              <span className="mt-1 flex-1 text-sm text-muted-foreground">{a.body}</span>
              <span className="mt-3 flex items-center gap-1 text-sm text-accent">{a.cta}<ArrowUpRight className="h-3.5 w-3.5" /></span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
