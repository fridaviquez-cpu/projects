import { useMemo, useState } from 'react';
import { Plus, Columns3, MoreHorizontal, MapPin, CalendarDays, Search, ExternalLink } from 'lucide-react';
import type { CareerRecord, RecordInputStatus } from '@/lib/career-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, EmptyState, ErrorState, ListSkeleton, RecordDialog, ConfirmDelete, type FieldDef } from '@/components/kit';
import { daysUntil, fmtDate, relLabel, toInput, useRecordMutations, useRecords, useSession } from '@/lib/orvyn';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'saved', label: 'Saved', statuses: ['saved'] },
  { key: 'applied', label: 'Applied', statuses: ['applied'] },
  { key: 'assessment', label: 'Assessment', statuses: ['assessment'] },
  { key: 'interview', label: 'Interview', statuses: ['interview'] },
  { key: 'offer', label: 'Offer', statuses: ['offer'] },
  { key: 'rejected', label: 'Rejected', statuses: ['rejected'] },
  { key: 'withdrawn', label: 'Withdrawn', statuses: ['withdrawn'] },
];
const STATUS_OPTS = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

export const OPP_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Role', required: true, placeholder: 'Junior Data Analyst' },
  { name: 'company', label: 'Company', half: true },
  { name: 'status', label: 'Stage', type: 'select', options: STATUS_OPTS, half: true },
  { name: 'location', label: 'Location', half: true, placeholder: 'Remote, Chicago...' },
  { name: 'salary', label: 'Compensation', half: true },
  { name: 'deadline', label: 'Application deadline', type: 'date', half: true },
  { name: 'interviewAt', label: 'Interview time', type: 'datetime', half: true },
  { name: 'url', label: 'Posting link', type: 'url', half: true },
  { name: 'contact', label: 'Contact', half: true },
  { name: 'description', label: 'Job description', type: 'textarea', rows: 5, placeholder: 'Paste the posting. Coach and resume tailoring use it.' },
  { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
];

function OppCard({ r, onEdit, onDelete, onMove }: { r: CareerRecord; onEdit: () => void; onDelete: () => void; onMove: (s: string) => void }) {
  const when = r.interviewAt || r.deadline;
  const n = daysUntil(when);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', r.id)}
      onClick={onEdit}
      className="group cursor-grab rounded-lg border bg-card p-4 transition-colors hover:border-[hsl(220_9%_28%)] active:cursor-grabbing"
      data-testid={`card-opportunity-${r.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] leading-snug">{r.title}</div>
          {r.company && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{r.company}</div>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" aria-label={`Actions for ${r.title}${r.company ? ` at ${r.company}` : ''}`} className="-mr-2 -mt-1 h-7 w-7 opacity-60 group-hover:opacity-100" data-testid={`button-menu-${r.id}`}><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            {r.url && <DropdownMenuItem onClick={() => window.open(r.url, '_blank', 'noopener')}>Open posting</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Move to</DropdownMenuLabel>
            {STATUS_OPTS.filter((s) => s.value !== r.status).map((s) => <DropdownMenuItem key={s.value} onClick={() => onMove(s.value)}>{s.label}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(r.location || when) && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
          {r.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.location}</span>}
          {when && <span className={cn('inline-flex items-center gap-1', n !== null && n >= 0 && n <= 3 && 'text-[hsl(38_80%_70%)]')}><CalendarDays className="h-3 w-3" />{r.interviewAt ? 'Interview ' : ''}{n !== null && Math.abs(n) <= 14 ? relLabel(n) : fmtDate(when)}</span>}
          {r.url && <ExternalLink className="h-3 w-3" />}
          {r.status === 'rejected' || r.status === 'withdrawn' ? <span className="uppercase font-mono tracking-wider text-[10px]">{r.status}</span> : null}
        </div>
      )}
    </div>
  );
}

export default function Opportunities() {
  const { isLoading: authLoading } = useSession();
  const q = useRecords('opportunity');
  const { update } = useRecordMutations();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; record?: CareerRecord | null; status?: string }>({ open: false });
  const [del, setDel] = useState<CareerRecord | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return s ? q.items.filter((r) => `${r.title} ${r.company ?? ''} ${r.location ?? ''}`.toLowerCase().includes(s)) : q.items;
  }, [q.items, search]);

  const move = (r: CareerRecord, status: string) => {
    if (r.status === status) return;
    update.mutate({ id: r.id, data: toInput(r, { status: status as RecordInputStatus }) }, {
      onSuccess: () => toast({ title: `Moved to ${status}`, description: r.title }),
      onError: (e) => toast({ title: 'Could not move', description: (e as Error).message, variant: 'destructive' }),
    });
  };


  return (
    <div>
      <PageHeader
        eyebrow="Opportunities"
        title="Your pipeline"
        sub="Drag cards between stages, or use the card menu on touch devices."
        actions={<Button onClick={() => setDialog({ open: true, record: null, status: 'saved' })} data-testid="button-add-opportunity"><Plus className="mr-1.5 h-4 w-4" />Add opportunity</Button>}
      />
      {q.isLoading || authLoading ? <ListSkeleton rows={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.items.length === 0 ? (
        <EmptyState icon={<Columns3 className="h-4 w-4" />} title="No opportunities yet" body="Save a role you are considering. Add the job description so coach and resume tailoring can use it." action={<Button onClick={() => setDialog({ open: true, record: null, status: 'saved' })}>Add your first</Button>} />
      ) : (
        <>
          <div className="relative mb-5 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by role, company, place" className="h-9 bg-card pl-9 text-[13px]" data-testid="input-search" />
          </div>
          <div className="-mx-5 overflow-x-auto px-5 pb-4 scroll-thin md:-mx-10 md:px-10">
            <div className="grid min-w-[1260px] grid-cols-7 gap-3">
              {COLUMNS.map((col, ci) => {
                const items = filtered.filter((r) => col.statuses.includes(r.status ?? 'saved'));
                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
                    onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault(); setOver(null);
                      const r = q.items.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                      if (r && !col.statuses.includes(r.status ?? 'saved')) move(r, col.statuses[0]);
                    }}
                    className={cn('rise flex min-h-[420px] flex-col rounded-xl border border-transparent bg-card/35 p-2 transition-colors', over === col.key && 'border-dashed border-foreground/30 bg-card/70')}
                    style={{ animationDelay: `${ci * 40}ms` }}
                    data-testid={`column-${col.key}`}
                  >
                    <div className="flex items-center justify-between px-2 pb-3 pt-1.5">
                      <span className="text-[12.5px] text-muted-foreground">{col.label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((r) => <OppCard key={r.id} r={r} onEdit={() => setDialog({ open: true, record: r })} onDelete={() => setDel(r)} onMove={(s) => move(r, s)} />)}
                    </div>
                    {col.key !== 'rejected' && col.key !== 'withdrawn' && (
                      <button aria-label={`Add opportunity to ${col.label}`} onClick={() => setDialog({ open: true, record: null, status: col.statuses[0] })} className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-2 text-[12.5px] text-muted-foreground/70 hover:bg-card hover:text-foreground" data-testid={`button-add-${col.key}`}>
                        <Plus className="h-3.5 w-3.5" />Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      <RecordDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        kind="opportunity"
        heading={dialog.record ? 'Edit opportunity' : 'New opportunity'}
        fields={OPP_FIELDS}
        record={dialog.record}
        defaults={{ status: (dialog.status ?? 'saved') as RecordInputStatus }}
      />
      <ConfirmDelete record={del} onOpenChange={(o) => !o && setDel(null)} what="opportunity" />
    </div>
  );
}
