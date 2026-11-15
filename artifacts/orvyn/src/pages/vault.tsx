import { useState } from 'react';
import { Plus, ImageUp, Archive, Pencil, Trash2 } from 'lucide-react';
import type { CareerRecord } from '@/lib/career-client';
import { Button } from '@/components/ui/button';
import { ScreenshotBatchDialog } from '@/components/screenshot-batch';
import { PageHeader, EmptyState, ErrorState, ListSkeleton, RecordDialog, ConfirmDelete, Panel, type FieldDef } from '@/components/kit';
import { fmtDate, useRecords, useSession } from '@/lib/orvyn';
import { cn } from '@/lib/utils';

const CATS = [
  { value: 'experience', label: 'Experience' },
  { value: 'education', label: 'Education' },
  { value: 'internship', label: 'Internship' },
  { value: 'project', label: 'Project' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'accomplishment', label: 'Accomplishment' },
  { value: 'skill', label: 'Skill' },
];

const FIELDS: FieldDef[] = [
  { name: 'title', label: 'Title', required: true, placeholder: 'Research Assistant, B.S. Economics, Hackathon winner...' },
  { name: 'category', label: 'Type', type: 'select', options: CATS, half: true },
  { name: 'company', label: 'Organization', half: true },
  { name: 'location', label: 'Location', half: true },
  { name: 'startDate', label: 'Start', type: 'date', half: true },
  { name: 'endDate', label: 'End (blank if ongoing)', type: 'date', half: true },
  { name: 'description', label: 'What you did', type: 'textarea', rows: 4 },
  { name: 'results', label: 'Measurable results', type: 'textarea', rows: 3, placeholder: 'Cut report time from 6h to 40min; grew club membership 38 to 112' },
  { name: 'skills', label: 'Skills used', placeholder: 'SQL, Tableau, stakeholder interviews' },
];

export default function Vault() {
  const { isLoading: authLoading } = useSession();
  const q = useRecords('experience');
  const [cat, setCat] = useState('all');
  const [dialog, setDialog] = useState<{ open: boolean; record?: CareerRecord | null }>({ open: false });
  const [batch, setBatch] = useState(false);
  const [del, setDel] = useState<CareerRecord | null>(null);


  const items = cat === 'all' ? q.items : q.items.filter((r) => (r.category ?? 'experience') === cat);
  const count = (c: string) => q.items.filter((r) => (r.category ?? 'experience') === c).length;

  return (
    <div>
      <PageHeader
        eyebrow="Vault"
        title="Everything you have done"
        sub="Verified experience is the source for resumes, coaching and insights. Be specific: numbers carry weight."
        actions={<>
          <Button variant="outline" onClick={() => setBatch(true)} data-testid="button-upload-screenshots"><ImageUp className="mr-1.5 h-4 w-4" />Upload screenshots</Button>
          <Button onClick={() => setDialog({ open: true, record: null })} data-testid="button-add-entry"><Plus className="mr-1.5 h-4 w-4" />Add entry</Button>
        </>}
      />
      <div className="rise rise-1 mb-6 flex gap-1 overflow-x-auto scroll-thin pb-1">
        {[{ value: 'all', label: 'All' }, ...CATS].map((c) => (
          <button key={c.value} onClick={() => setCat(c.value)} data-testid={`tab-${c.value}`}
            className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors', cat === c.value ? 'border-foreground/60 bg-card text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {c.label}<span className="ml-1.5 font-mono text-[10.5px] opacity-60">{c.value === 'all' ? q.items.length : count(c.value)}</span>
          </button>
        ))}
      </div>
      {q.isLoading || authLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : items.length === 0 ? (
        <EmptyState icon={<Archive className="h-4 w-4" />} title={cat === 'all' ? 'Your vault is empty' : `No ${cat} entries yet`} body="Start with one thing you did and what changed because of it. You can refine it later." action={<Button onClick={() => setDialog({ open: true, record: null })}>Add entry</Button>} />
      ) : (
        <div className="space-y-3">
          {items.map((r, i) => (
            <Panel key={r.id} className="rise group p-5 md:p-6" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} data-testid={`card-entry-${r.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="eyebrow mb-2">{r.category ?? 'experience'}</div>
                  <h3 className="text-[16px] font-medium">{r.title}</h3>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {[r.company, r.location, (r.startDate || r.endDate) && `${fmtDate(r.startDate) || '...'} - ${r.endDate ? fmtDate(r.endDate) : 'Present'}`].filter(Boolean).join('  /  ')}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 opacity-70 group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDialog({ open: true, record: r })} aria-label="Edit" data-testid={`button-edit-${r.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDel(r)} aria-label="Delete" data-testid={`button-delete-${r.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {r.description && <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/85">{r.description}</p>}
              {r.results && (
                <div className="mt-4 border-l-2 border-signal/60 pl-4 text-[13.5px] leading-relaxed whitespace-pre-wrap">{r.results}</div>
              )}
              {r.skills && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => <span key={s} className="rounded-md border bg-background px-2 py-0.5 text-[11.5px] text-muted-foreground">{s}</span>)}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
      <RecordDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} kind="experience" heading={dialog.record ? 'Edit entry' : 'New vault entry'} fields={FIELDS} record={dialog.record} defaults={{ category: cat === 'all' ? 'experience' : cat }} />
      <ScreenshotBatchDialog open={batch} onOpenChange={setBatch} target="experience" fields={FIELDS} defaults={{ category: cat === 'all' ? 'experience' : cat }} />
      <ConfirmDelete record={del} onOpenChange={(o) => !o && setDel(null)} what="entry" />
    </div>
  );
}
