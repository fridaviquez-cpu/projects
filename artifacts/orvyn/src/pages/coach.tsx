import { useState } from 'react';
import type { ScreenshotDraft } from '@workspace/api-client-react';
import { ScreenshotUpload, ReplaceOffers } from '@/components/screenshot-upload';
import { VaultSourcePicker } from '@/components/vault-source-picker';
import { MessageSquareText, Sparkles, Trash2 } from 'lucide-react';
import { useRunCoach, type CareerRecord } from '@/lib/career-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, EmptyState, ErrorState, ListSkeleton, ConfirmDelete, Panel, InlineError, AiNotice } from '@/components/kit';
import { fmtDate, useInvalidate, useRecords, useSession } from '@/lib/orvyn';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STAR = [
  ['S', 'Situation', 'Set the scene in one or two sentences.'],
  ['T', 'Task', 'What were you responsible for?'],
  ['A', 'Action', 'What did you do, specifically? Say "I".'],
  ['R', 'Result', 'What changed? Quantify it if you can.'],
];

export default function Coach() {
  const { isLoading: authLoading } = useSession();
  const sessions = useRecords('interview');
  const opps = useRecords('opportunity');
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const gen = useRunCoach({ mutation: { onSuccess: () => invalidate() } });
  const fb = useRunCoach({ mutation: { onSuccess: () => invalidate() } });
  const [opp, setOpp] = useState('');
  const [selectedExperienceIds, setSelectedExperienceIds] = useState<string[]>();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [del, setDel] = useState<CareerRecord | null>(null);
  const [offers, setOffers] = useState<{ key: string; label: string; value: string }[]>([]);
  const [shotNote, setShotNote] = useState<string | null>(null);

  // Fills only empty fields; differing values become explicit offers. Never derives an answer from a question.
  const applyShot = (d: ScreenshotDraft) => {
    const qx = typeof d.fields?.question === 'string' ? d.fields.question.trim() : '';
    const ax = typeof d.fields?.answer === 'string' ? d.fields.answer.trim() : '';
    const next: { key: string; label: string; value: string }[] = [];
    const filled: string[] = [];
    if (qx) { if (!question.trim()) { setQuestion(qx); filled.push('question'); } else if (question.trim() !== qx) next.push({ key: 'question', label: 'Question', value: qx }); }
    if (ax) { if (!answer.trim()) { setAnswer(ax); filled.push('answer'); } else if (answer.trim() !== ax) next.push({ key: 'answer', label: 'Answer', value: ax }); }
    setOffers(next);
    setShotNote(filled.length ? `Filled the ${filled.join(' and ')} from your screenshots. Review, then request feedback.` : !qx && !ax ? 'No interview question or answer was found in those screenshots.' : null);
  };
  const takeOffer = (keys: string[]) => {
    for (const o of offers) if (keys.includes(o.key)) (o.key === 'question' ? setQuestion : setAnswer)(o.value);
    setOffers((p) => p.filter((o) => !keys.includes(o.key)));
  };


  const open = sessions.items.find((s) => s.id === openId);

  return (
    <div>
      <PageHeader eyebrow="Coach" title="Practice before it counts" sub="Pick a tracked role, generate behavioral and technical questions, then write an answer and get structured feedback." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Panel className="rise rise-1 p-6">
            <div className="eyebrow mb-4">01 / Generate questions</div>
            <Label htmlFor="coach-opportunity" className="sr-only">Tracked opportunity</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={opp} onValueChange={setOpp}>
                <SelectTrigger id="coach-opportunity" className="bg-background sm:flex-1" data-testid="select-opportunity"><SelectValue placeholder={opps.items.length ? 'Choose a tracked opportunity' : 'Add an opportunity first'} /></SelectTrigger>
                <SelectContent>{opps.items.map((o) => <SelectItem key={o.id} value={o.id}>{o.title}{o.company ? ` / ${o.company}` : ''}</SelectItem>)}</SelectContent>
              </Select>
              <Button disabled={!opp || gen.isPending} data-testid="button-generate-questions"
                onClick={() => gen.mutate({ data: { mode: 'questions', opportunityId: opp, selectedExperienceIds } }, { onSuccess: (r) => { setOpenId(r.id); toast({ title: 'Questions saved to your sessions' }); } })}>
                <Sparkles className="mr-1.5 h-4 w-4" />{gen.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
            <div className="mt-3"><InlineError error={gen.error} /></div>
            <VaultSourcePicker value={selectedExperienceIds} onChange={setSelectedExperienceIds} disabled={gen.isPending} />
          </Panel>

          <Panel className="rise rise-2 p-6">
            <div className="eyebrow mb-4">02 / Practice an answer</div>
            <div className="space-y-4">
              <ScreenshotUpload target="coach" onResult={applyShot} label="Fill question and answer from screenshots" disabled={fb.isPending} testId="coach-screenshots" />
              <ReplaceOffers offers={offers} onUse={takeOffer} onDismiss={() => setOffers([])} />
              {shotNote && <p role="status" className="text-[12.5px] text-muted-foreground" data-testid="text-coach-screenshot">{shotNote}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="coach-question" className="text-[12px] font-normal text-muted-foreground">Question</Label>
                <Textarea id="coach-question" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tell me about a time you handled conflicting priorities." className="bg-background" data-testid="textarea-question" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coach-answer" className="text-[12px] font-normal text-muted-foreground">Your answer</Label>
                <Textarea id="coach-answer" rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write it as you would say it." className="bg-background leading-relaxed" data-testid="textarea-answer" />
                <div className="text-right font-mono text-[11px] text-muted-foreground">{answer.split(/\s+/).filter(Boolean).length} words</div>
              </div>
              <AiNotice />
              <InlineError error={fb.error} />
              <Button disabled={!question.trim() || !answer.trim() || fb.isPending} data-testid="button-get-feedback"
                onClick={() => fb.mutate({ data: { mode: 'feedback', question: question.trim(), answer: answer.trim(), opportunityId: opp || undefined } }, { onSuccess: (r) => { setOpenId(r.id); toast({ title: 'Feedback saved' }); } })}>
                {fb.isPending ? 'Reviewing...' : 'Get STAR feedback'}
              </Button>
            </div>
          </Panel>

          {open && (
            <Panel className="rise p-6" data-testid="panel-session">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><div className="eyebrow mb-2">Session / {fmtDate(open.createdAt, true)}</div><h3 className="text-[17px] font-medium">{open.title}</h3></div>
                <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>Close</Button>
              </div>
              <div className="whitespace-pre-wrap text-[14px] leading-[1.75] text-foreground/90">{open.content || open.notes || open.description}</div>
              <p className="mt-6 border-t pt-4 text-[12px] text-muted-foreground">AI-generated. Review for accuracy and adapt it to your real experience.</p>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel className="rise rise-2 p-5">
            <div className="eyebrow mb-4">STAR guide</div>
            <div className="space-y-3">
              {STAR.map(([l, t, d]) => (
                <div key={l} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border font-mono text-[12px]">{l}</span>
                  <div><div className="text-[13px]">{t}</div><div className="text-[12px] text-muted-foreground">{d}</div></div>
                </div>
              ))}
            </div>
          </Panel>
          <div>
            <div className="eyebrow mb-3">Saved sessions</div>
            {sessions.isLoading || authLoading ? <ListSkeleton rows={2} /> : sessions.isError ? <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} /> : sessions.items.length === 0 ? (
              <EmptyState icon={<MessageSquareText className="h-4 w-4" />} title="No sessions yet" body="Generated questions and feedback are saved here." />
            ) : (
              <div className="space-y-1.5">
                {sessions.items.map((s) => (
                  <div key={s.id} className={cn('group flex items-center rounded-lg border', s.id === openId ? 'bg-card border-foreground/25' : 'border-transparent hover:bg-card/60')}>
                    <button onClick={() => setOpenId(s.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left" data-testid={`button-session-${s.id}`}>
                      <div className="truncate text-[13px]">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(s.createdAt)}</div>
                    </button>
                    <Button size="icon" variant="ghost" className="mr-1 h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => setDel(s)} aria-label="Delete session"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDelete record={del} onOpenChange={(o) => !o && setDel(null)} what="session" onDeleted={() => setOpenId(null)} />
    </div>
  );
}
