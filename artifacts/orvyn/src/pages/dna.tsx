import { useEffect, useRef, useState } from 'react';
import type { ScreenshotDraft } from '@workspace/api-client-react';
import { ScreenshotUpload, ReplaceOffers } from '@/components/screenshot-upload';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, ErrorState, ListSkeleton, Panel, InlineError } from '@/components/kit';
import { fmtDate, toInput, useRecordMutations, useRecords, useSession } from '@/lib/orvyn';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { describeDna, scoreDna, validDnaAnswers } from '@/lib/career-domain';

const QUESTIONS = [
  'Before acting, I like to break a problem into its parts.',
  'I do my best thinking when talking ideas through with others.',
  'I start things without waiting to be asked.',
  'I enjoy finding the pattern in messy information.',
  'I notice when someone on a team feels left out.',
  'I am comfortable making a call with incomplete information.',
  'I check my reasoning against evidence before I commit.',
  'I would rather share credit than work alone.',
  'I volunteer for the unclear, unowned task.',
  'I keep notes or systems to track how things work.',
  'I try to understand what motivates the people around me.',
  'When something stalls, I am usually the one to push it forward.',
];
const SCALE = ['Rarely', 'Sometimes', 'Often', 'Usually', 'Almost always'];

export default function Dna() {
  const { isLoading: authLoading } = useSession();
  const q = useRecords('dna');
  const { create, update } = useRecordMutations();
  const { toast } = useToast();
  const rec = q.items[0];
  const [answers, setAnswers] = useState<number[]>(Array(12).fill(0));
  const [official, setOfficial] = useState('');
  const [retake, setRetake] = useState(false);
  const init = useRef<string | null>(null);
  const retakeButton = useRef<HTMLButtonElement>(null);
  const quizStart = useRef<HTMLDivElement>(null);
  const wasRetaking = useRef(false);
  const [offers, setOffers] = useState<{ key: string; label: string; value: string }[]>([]);
  const [shotNote, setShotNote] = useState<string | null>(null);
  const officialRef = useRef(official);
  officialRef.current = official;

  // Fills official results only. The twelve reflection prompts are never answered from a screenshot.
  const applyShot = (d: ScreenshotDraft) => {
    const x = typeof d.fields?.officialStrengths === 'string' ? d.fields.officialStrengths.trim() : '';
    setOffers([]);
    if (!x) return setShotNote('No CliftonStrengths results were found in those screenshots.');
    const cur = officialRef.current.trim();
    if (!cur) { setOfficial(x); setShotNote('Filled from your screenshots. Review, then save strengths.'); }
    else if (cur !== x) { setOffers([{ key: 'officialStrengths', label: 'Official strengths', value: x }]); setShotNote(null); }
    else setShotNote('Your strengths already match the screenshot.');
  };

  useEffect(() => {
    if (retake) quizStart.current?.focus();
    else if (wasRetaking.current) retakeButton.current?.focus();
    wasRetaking.current = retake;
  }, [retake]);

  useEffect(() => {
    if (rec && init.current !== rec.id) {
      init.current = rec.id;
      if (rec.answers?.length === 12) setAnswers(rec.answers);
      setOfficial(rec.officialStrengths ?? '');
    }
  }, [rec]);


  const done = answers.filter(Boolean).length;
  const err = create.error || update.error;
  const pending = create.isPending || update.isPending;
  const hasAnswers = !!rec && validDnaAnswers(rec.answers);
  const showQuiz = !hasAnswers || retake;

  const submit = () => {
    const patch = { answers, officialStrengths: official.trim(), content: describeDna(answers) };
    const onSuccess = () => { setRetake(false); toast({ title: 'Profile saved' }); };
    if (rec) update.mutate({ id: rec.id, data: toInput(rec, patch) }, { onSuccess });
    else create.mutate({ data: { kind: 'dna', title: 'Career DNA reflection', ...patch } }, { onSuccess });
  };
  const saveOfficial = () => {
    const onSuccess = () => { setShotNote(null); toast({ title: 'Strengths saved' }); };
    if (rec) update.mutate({ id: rec.id, data: toInput(rec, { officialStrengths: official.trim() }) }, { onSuccess });
    // Strengths-only record: reflection answers stay absent until the prompts are completed.
    else create.mutate({ data: { kind: 'dna', title: 'Career DNA reflection', officialStrengths: official.trim() } }, { onSuccess });
  };

  return (
    <div>
      <PageHeader eyebrow="Career DNA" title="How you work" sub="An original self-reflection, not a clinical, scientific or official assessment. Twelve prompts feed three transparent dimensions (Analytical, Collaborative, Initiative); each averages four answers on a 0-100 scale." />
      {q.isLoading || authLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            {rec && hasAnswers && !retake && (
              <Panel className="rise p-6 md:p-8" data-testid="panel-profile">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="eyebrow mb-2">Your profile / {fmtDate(rec.updatedAt)}</div><h2 className="text-[20px] font-medium">Reflection results</h2></div>
                  <Button ref={retakeButton} size="sm" variant="outline" onClick={() => setRetake(true)} data-testid="button-retake">Retake</Button>
                </div>
                {validDnaAnswers(rec.answers) && (
                  <div className="mt-8 space-y-5">
                    {scoreDna(rec.answers!).map((d) => {
                      const p = d.score;
                      return (
                        <div key={d.name} data-testid={`stat-${d.name.toLowerCase()}`}>
                          <div className="mb-2 flex items-baseline justify-between"><span className="text-[14px]">{d.name} <span className="text-[12px] text-muted-foreground">{d.description}</span></span><span className="font-mono text-[13px]">{p}%</span></div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full origin-left rounded-full bg-foreground transition-transform duration-700" style={{ transform: `scaleX(${p / 100})` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {rec.content && <div className="mt-8 whitespace-pre-wrap border-t pt-6 text-[14px] leading-[1.75] text-foreground/90" data-testid="text-dna-content">{rec.content}</div>}
              </Panel>
            )}
            {showQuiz && (
              <div ref={quizStart} tabIndex={-1} aria-label="Career DNA reflection questions" className="space-y-3">
                <div className="flex items-center justify-between"><span className="eyebrow">{done} of 12 answered</span>{retake && hasAnswers && <Button size="sm" variant="ghost" onClick={() => setRetake(false)}>Cancel</Button>}</div>
                {QUESTIONS.map((qq, i) => (
                  <Panel key={i} className="rise p-5" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex gap-4"><span className="font-mono text-[11px] text-muted-foreground pt-0.5">{String(i + 1).padStart(2, '0')}</span><p id={`dna-question-${i}`} className="text-[14.5px]">{qq}</p></div>
                    <div role="group" aria-labelledby={`dna-question-${i}`} className="mt-4 grid grid-cols-5 gap-1.5">
                      {SCALE.map((s, v) => (
                        <button key={s} aria-pressed={answers[i] === v + 1} onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? v + 1 : x)))} data-testid={`button-answer-${i}-${v + 1}`}
                          className={cn('rounded-md border px-1 py-2 text-[11.5px] transition-colors', answers[i] === v + 1 ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:border-foreground/40 hover:text-foreground')}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </Panel>
                ))}
                <InlineError error={err} />
                <Button className="w-full sm:w-auto" disabled={done < 12 || pending} onClick={submit} data-testid="button-submit-dna">{pending ? 'Saving...' : done < 12 ? `Answer ${12 - done} more` : 'Save my profile'}</Button>
              </div>
            )}
          </div>
          <Panel className="rise rise-2 h-fit p-5">
            <div className="eyebrow mb-2">Official CliftonStrengths</div>
            <p className="mb-4 text-[12.5px] leading-relaxed text-muted-foreground">If you have taken the official assessment, record your results here. Kept separate from the reflection above.</p>
            <Textarea rows={6} value={official} onChange={(e) => setOfficial(e.target.value)} placeholder={'1. Learner\n2. Achiever\n3. ...'} className="bg-background font-mono text-[12.5px]" data-testid="textarea-official-strengths" />
            <Button size="sm" className="mt-3" variant="outline" onClick={saveOfficial} disabled={pending || official.trim() === (rec?.officialStrengths ?? '').trim()} data-testid="button-save-strengths">Save strengths</Button>
            {!rec && <p className="mt-2 text-[11.5px] text-muted-foreground">You can save these now, before or without the reflection.</p>}
            <div className="mt-3"><InlineError error={err} /></div>
            <div className="mt-5 border-t pt-4 space-y-3">
              <ScreenshotUpload target="strengths" onResult={applyShot} label="Read official results from screenshots" disabled={pending} testId="strengths-screenshots" />
              <ReplaceOffers offers={offers} onUse={(keys) => { if (keys.length && offers[0]) setOfficial(offers[0].value); setOffers([]); }} onDismiss={() => setOffers([])} />
              {shotNote && <p role="status" className="text-[12px] text-muted-foreground" data-testid="text-strengths-screenshot">{shotNote}</p>}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
