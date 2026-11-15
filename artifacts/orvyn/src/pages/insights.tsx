import { useMemo, useState } from 'react';
import { Plus, ImageUp, Target, Pencil, Trash2, Check, Sparkles } from 'lucide-react';
import { useRunCoach, useGetSummary, getGetSummaryQueryKey, type CareerRecord, type RecordInputStatus } from '@/lib/career-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, AiNotice, InlineError, EmptyState, ErrorState, ListSkeleton, RecordDialog, ConfirmDelete, Panel, type FieldDef } from '@/components/kit';
import { daysUntil, fmtDate, relLabel, toInput, useRecordMutations, useRecords, useSession } from '@/lib/orvyn';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const GOAL_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Goal', required: true, placeholder: 'Apply to 8 analyst roles this month' },
  { name: 'deadline', label: 'Target date', type: 'date', half: true },
  { name: 'status', label: 'Status', type: 'select', half: true, options: [{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }] },
  { name: 'description', label: 'Why it matters / how you will measure it', type: 'textarea', rows: 3 },
];
const STAGES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'];

export default function Insights() {
  const { isLoading: authLoading } = useSession();
  const s = useGetSummary({ query: { queryKey: getGetSummaryQueryKey() } });
  const goals = useRecords('goal');
  const opps = useRecords('opportunity');
  const { update } = useRecordMutations();
  const reads = useRecords('insight');
  const ai = useRunCoach();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; record?: CareerRecord | null; shots?: boolean }>({ open: false });
  const [del, setDel] = useState<CareerRecord | null>(null);

  const stageCounts = useMemo(() => STAGES.map((st) => ({ st, n: opps.items.filter((o) => (o.status ?? 'saved') === st).length })), [opps.items]);
  const max = Math.max(1, ...stageCounts.map((x) => x.n));


  const d = s.data;
  const toggle = (g: CareerRecord) => update.mutate({ id: g.id, data: toInput(g, { status: (g.status === 'completed' ? 'active' : 'completed') as RecordInputStatus }) });
  const active = goals.items.filter((g) => g.status !== 'completed');
  const completed = goals.items.filter((g) => g.status === 'completed');

  return (
    <div>
      <PageHeader eyebrow="Insights" title="Where you stand" sub="Calculated only from records you have saved." actions={<>
        <Button variant="outline" onClick={() => setDialog({ open: true, record: null, shots: true })} data-testid="button-upload-screenshots"><ImageUp className="mr-1.5 h-4 w-4" />Upload screenshots</Button>
        <Button onClick={() => setDialog({ open: true, record: null })} data-testid="button-add-goal"><Plus className="mr-1.5 h-4 w-4" />New goal</Button>
      </>} />
      {s.isError ? <ErrorState error={s.error} onRetry={() => s.refetch()} /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Panel className="rise rise-1 p-6">
            <div className="eyebrow mb-6">Pipeline by stage</div>
            {opps.isLoading || authLoading ? <Skeleton className="h-40 bg-muted" /> : opps.items.length === 0 ? <p className="text-[13.5px] text-muted-foreground">No opportunities tracked yet.</p> : (
              <div className="space-y-3">
                {stageCounts.map(({ st, n }) => (
                  <div key={st} className="grid grid-cols-[90px_1fr_28px] items-center gap-3 text-[12.5px]">
                    <span className="capitalize text-muted-foreground">{st}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full origin-left rounded-full transition-transform duration-700', st === 'offer' ? 'bg-signal' : 'bg-foreground/80')} style={{ transform: `scaleX(${n / max})` }} /></div>
                    <span className="text-right font-mono">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel className="rise rise-2 grid grid-cols-2 gap-px overflow-hidden bg-border">
            {[
              ['Current pipeline conversion', d ? `${Number(d.conversionRate).toFixed(1)}%` : null, 'Interview + offer stages / submitted'],
              ['Active opportunities', d?.active, 'Not yet closed'],
              ['Vault entries', d?.experienceCount, `${d?.resumeCount ?? 0} resumes`],
              ['Goals completed', d ? `${d.completedGoals}/${d.totalGoals}` : null, 'All time'],
            ].map(([l, v, h]) => (
              <div key={String(l)} className="bg-card p-5">
                <div className="text-[12px] text-muted-foreground">{l}</div>
                {s.isLoading || authLoading ? <Skeleton className="mt-3 h-7 w-14 bg-muted" /> : <div className="mt-3 font-mono text-[26px]">{v}</div>}
                <div className="mt-1 text-[11px] text-muted-foreground">{h}</div>
              </div>
            ))}
          </Panel>
        </div>
      )}

      <Panel className="rise rise-3 mt-6 p-6" data-testid="panel-ai-insights">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow mb-2">Read on your progress</div>
            <p className="max-w-xl text-[13px] text-muted-foreground">Sends your 50 most recently updated records to the assistant for a written read on patterns, gaps and next steps. Saved here on this device.</p>
          </div>
          <Button variant="outline" disabled={ai.isPending || !goals.all.length} onClick={() => ai.mutate({ data: { mode: 'insights' } }, { onSuccess: () => toast({ title: 'Insight saved on this device' }) })} data-testid="button-generate-insight">
            <Sparkles className="mr-1.5 h-4 w-4 text-signal" />{ai.isPending ? 'Reading your records...' : 'Generate a read'}
          </Button>
        </div>
        {!goals.all.length && <p className="mt-3 text-[12px] text-muted-foreground">Add at least one record first.</p>}
        <div className="mt-3"><InlineError error={ai.error} /></div>
        <AiNotice className="mt-2" />
        {reads.items.slice(0, 1).map((r) => (
          <div key={r.id} className="mt-5 border-t pt-5">
            <div className="flex items-start justify-between gap-3"><div><div className="eyebrow mb-1">{fmtDate(r.createdAt, true)}</div><div className="text-[15px] font-medium">{r.title}</div></div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDel(r)} aria-label="Delete this read"><Trash2 className="h-3.5 w-3.5" /></Button></div>
            <div className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.75] text-foreground/90">{r.content}</div>
          </div>
        ))}
      </Panel>

      <div className="mt-12">
        <div className="eyebrow mb-4">Professional goals</div>
        {goals.isLoading || authLoading ? <ListSkeleton rows={2} /> : goals.isError ? <ErrorState error={goals.error} onRetry={() => goals.refetch()} /> : goals.items.length === 0 ? (
          <EmptyState icon={<Target className="h-4 w-4" />} title="No goals yet" body="Set something concrete and dated. Small, measurable goals are easier to finish." action={<Button onClick={() => setDialog({ open: true, record: null })}>Set a goal</Button>} />
        ) : (
          <div className="space-y-2">
            {[...active, ...completed].map((g) => {
              const isDone = g.status === 'completed';
              const n = daysUntil(g.deadline);
              return (
                <Panel key={g.id} className="group flex items-start gap-4 p-4" data-testid={`card-goal-${g.id}`}>
                  <button onClick={() => toggle(g)} aria-label={isDone ? 'Mark active' : 'Mark complete'} data-testid={`button-toggle-${g.id}`}
                    className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors', isDone ? 'border-signal bg-signal text-background' : 'hover:border-foreground')}>
                    {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-[14px]', isDone && 'text-muted-foreground line-through decoration-1')}>{g.title}</div>
                    {g.description && <p className="mt-1 text-[12.5px] text-muted-foreground">{g.description}</p>}
                    {g.deadline && <div className={cn('mt-1.5 text-[11.5px] text-muted-foreground', !isDone && n !== null && n < 0 && 'text-destructive')}>{fmtDate(g.deadline)} / {relLabel(n)}</div>}
                  </div>
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDialog({ open: true, record: g })} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDel(g)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
      <RecordDialog open={dialog.open} onOpenChange={(o) => setDialog((x) => ({ ...x, open: o }))} kind="goal" heading={dialog.record ? 'Edit goal' : 'New goal'} fields={GOAL_FIELDS} record={dialog.record} screenshotFirst={dialog.shots} defaults={{ status: 'active' }} />
      <ConfirmDelete record={del} onOpenChange={(o) => !o && setDel(null)} what={del?.kind === 'insight' ? 'read' : 'goal'} />
    </div>
  );
}
