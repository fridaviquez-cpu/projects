import { Link } from 'wouter';
import { ArrowUpRight, CalendarClock, Columns3, Archive, FileText, MessageSquareText, Sparkles, History } from 'lucide-react';
import { useGetSummary, getGetSummaryQueryKey, type CareerRecord } from '@/lib/career-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel, ErrorState, StatusPill, Wordmark } from '@/components/kit';
import { daysUntil, displayName, fmtDate, relLabel, useSession } from '@/lib/orvyn';

const KIND_ROUTE: Record<string, string> = {
  opportunity: '/opportunities', experience: '/vault', resume: '/resumes', interview: '/coach', dna: '/dna', goal: '/insights',
};

function Welcome() {
  const steps = [
    { h: '/vault', icon: Archive, t: 'Record what you have done', d: 'Experience, education, projects and measurable results in one vault.' },
    { h: '/opportunities', icon: Columns3, t: 'Track every opportunity', d: 'A clear pipeline from saved to offer, with deadlines that surface on their own.' },
    { h: '/resumes', icon: FileText, t: 'Shape resumes from evidence', d: 'Plain-text, ATS-friendly drafts tailored to a specific role.' },
    { h: '/coach', icon: MessageSquareText, t: 'Practice before it counts', d: 'Role-specific questions and STAR feedback on your written answers.' },
  ];
  return (
    <div>
      <section className="rise pt-4 md:pt-10">
        <div className="eyebrow mb-6">Your career space, on this device</div>
        <h1 className="max-w-3xl text-[44px] md:text-[72px] leading-[0.98] tracking-[-0.045em] font-medium">
          Make your next move <span className="font-display italic tracking-[-0.02em]">count.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
          orvyn grows with you from first internship to next role. Verified experience connects to the opportunities you pursue,
          the resumes you send and the interviews you prepare for.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button size="lg" asChild data-testid="button-start-vault"><Link href="/vault">Add your first experience</Link></Button>
          <Button size="lg" variant="outline" asChild data-testid="button-start-opportunity"><Link href="/opportunities">Track a role</Link></Button>
          <Button size="lg" variant="ghost" asChild data-testid="button-start-resume"><Link href="/resumes">Import a resume</Link></Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Panel className="rise rise-2 p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Your dashboard</div>
            <Wordmark className="text-[14px] opacity-60" />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            {['Active', 'Interviews', 'Offers', 'Vault'].map((l) => (
              <div key={l} className="bg-card p-4">
                <div className="text-[11.5px] text-muted-foreground">{l}</div>
                <div className="mt-2 font-mono text-[22px] text-muted-foreground/40">--</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-muted-foreground">Nothing here yet. Progress, deadlines and interviews appear as soon as you add your first record. No account needed: work is saved in this browser. Have a backup file? <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">Restore it in Settings</Link>.</p>
        </Panel>
        <Panel className="rise rise-3 divide-y">
          {steps.map(({ icon: Icon, t, d, h }, i) => (
            <Link key={t} href={h} className="flex gap-4 p-5 transition-colors hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="font-mono text-[11px] text-muted-foreground pt-0.5">0{i + 1}</span>
              <div>
                <div className="flex items-center gap-2 text-[14px]"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{t}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{d}</p>
              </div>
            </Link>
          ))}
        </Panel>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-card p-5" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-3 font-mono text-[28px] tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function RecordRow({ r, upcoming }: { r: CareerRecord; upcoming?: boolean }) {
  const when = r.interviewAt || r.deadline;
  const n = daysUntil(when);
  return (
    <Link href={KIND_ROUTE[r.kind] ?? '/'} className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-background/40" data-testid={`row-record-${r.id}`}>
      <div className="min-w-0">
        <div className="truncate text-[14px]">{r.title}</div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {[r.company, upcoming ? (r.interviewAt ? 'Interview' : 'Deadline') : r.kind].filter(Boolean).join('  /  ')}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-right">
        {upcoming ? (
          <div>
            <div className={`text-[12.5px] ${n !== null && n <= 3 ? 'text-[hsl(38_80%_70%)]' : ''}`}>{relLabel(n)}</div>
            <div className="text-[11.5px] text-muted-foreground">{fmtDate(when, true)}</div>
          </div>
        ) : (
          <>
            <StatusPill status={r.status} />
            <span className="hidden text-[11.5px] text-muted-foreground sm:inline">{fmtDate(r.updatedAt)}</span>
          </>
        )}
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { isLoading: authLoading, user } = useSession();
  const q = useGetSummary({ query: { queryKey: getGetSummaryQueryKey() } });

  if (authLoading || q.isLoading) return <Skeleton className="h-40 w-full bg-card" />;
  if (q.data && q.data.total === 0) return <Welcome />;

  const s = q.data;
  const first = displayName(user).split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="rise mb-10">
        <div className="eyebrow mb-3">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h1 className="text-[32px] md:text-[42px] leading-[1.05] tracking-[-0.04em] font-medium">
          {greet}{first ? `, ${first}` : ''}. <span className="text-muted-foreground">Make your next move <span className="font-display italic">count.</span></span>
        </h1>
      </div>

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <div className="rise rise-1 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
            {q.isLoading || !s ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-3 w-16 bg-muted" /><Skeleton className="mt-4 h-7 w-12 bg-muted" /></div>) : (
              <>
                <Stat label="Active opportunities" value={s.active} hint={`${s.total} records total`} />
                <Stat label="Interviews" value={s.interviews} />
                <Stat label="Offers" value={s.offers} hint={`${Number(s.conversionRate ?? 0).toFixed(1)}% current pipeline conversion`} />
                <Stat label="Vault entries" value={s.experienceCount} hint={`${s.resumeCount} resumes  /  ${s.completedGoals}/${s.totalGoals} goals`} />
              </>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Panel className="rise rise-2 overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2 text-[14px]"><CalendarClock className="h-4 w-4 text-muted-foreground" />Upcoming deadlines and interviews</div>
                <Link href="/opportunities" className="text-[12.5px] text-muted-foreground hover:text-foreground">Pipeline</Link>
              </div>
              {q.isLoading ? <div className="p-5 space-y-3"><Skeleton className="h-10 bg-muted" /><Skeleton className="h-10 bg-muted" /></div> :
                s?.upcoming.length ? <div className="divide-y">{s.upcoming.map((r) => <RecordRow key={r.id} r={r} upcoming />)}</div> : (
                  <div className="px-5 py-10 text-center">
                    <p className="text-[13.5px] text-muted-foreground">No dates on the horizon. Add a deadline or interview time to an opportunity.</p>
                    <Link href="/opportunities" className="mt-4 inline-block text-[13px] underline underline-offset-4">Open pipeline</Link>
                  </div>
                )}
            </Panel>

            <Panel className="rise rise-3 p-5">
              <div className="mb-4 flex items-center gap-2 text-[14px]"><Sparkles className="h-4 w-4 text-signal" />Recommended next</div>
              {q.isLoading ? <Skeleton className="h-24 bg-muted" /> : s?.recommendations.length ? (
                <ol className="space-y-3">
                  {s.recommendations.map((t, i) => (
                    <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed" data-testid={`text-recommendation-${i}`}>
                      <span className="font-mono text-[11px] text-muted-foreground pt-1">{String(i + 1).padStart(2, '0')}</span>{t}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-[13.5px] text-muted-foreground">You are caught up. Recommendations appear as your records grow.</p>}
            </Panel>
          </div>

          <Panel className="rise rise-4 mt-6 overflow-hidden">
            <div className="flex items-center gap-2 border-b px-5 py-4 text-[14px]"><History className="h-4 w-4 text-muted-foreground" />Recent changes</div>
            {q.isLoading ? <div className="p-5"><Skeleton className="h-10 bg-muted" /></div> : s?.recent.length ? (
              <div className="divide-y">{s.recent.map((r) => <RecordRow key={r.id} r={r} />)}</div>
            ) : (
              <div className="grid gap-px bg-border sm:grid-cols-3">
                {[
                  { h: '/vault', t: 'Add your first experience', d: 'Start with something you did and what changed because of it.' },
                  { h: '/opportunities', t: 'Track an opportunity', d: 'Save a role you are considering.' },
                  { h: '/dna', t: 'Reflect on how you work', d: 'Twelve quick prompts.' },
                ].map((x) => (
                  <Link key={x.h} href={x.h} className="bg-card p-5 hover:bg-background/40">
                    <div className="text-[14px]">{x.t}</div>
                    <div className="mt-1 text-[12.5px] text-muted-foreground">{x.d}</div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
