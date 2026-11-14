import { useEffect, useRef, useState } from 'react';
import { VaultSourcePicker } from '@/components/vault-source-picker';
import { Plus, FileText, Upload, Download, Sparkles, Trash2, Save, Check } from 'lucide-react';
import { useExtractResume, type ResumeFileInputContentType } from '@workspace/api-client-react';
import { store, useRunCoach, getListRecordsQueryKey, type CareerRecord } from '@/lib/career-client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, EmptyState, ErrorState, ListSkeleton, ConfirmDelete, Panel, InlineError, AiNotice } from '@/components/kit';
import { errMsg, fmtDate, toInput, useInvalidate, useRecordMutations, useRecords, useSession } from '@/lib/orvyn';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useResumeDrafts } from '@/lib/resume-drafts';

const TEMPLATE = `YOUR NAME
City, State | email@example.com | phone | linkedin.com/in/you

SUMMARY
One or two lines on who you are and the role you are pursuing.

EXPERIENCE
Role Title, Organization                                   Month Year - Month Year
- Action verb + what you did + measurable result

EDUCATION
Degree, School                                             Year

SKILLS
Skill, Skill, Skill
`;

const TYPES: Record<string, ResumeFileInputContentType> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

export default function Resumes() {
  const { isLoading: authLoading } = useSession();
  const q = useRecords('resume');
  const opps = useRecords('opportunity');
  const { create, update } = useRecordMutations();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const extract = useExtractResume();
  const coach = useRunCoach({ mutation: { onSuccess: () => invalidate() } });
  const drafts = useResumeDrafts();

  const [selId, setSelId] = useState<string | null>(drafts.selected);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loadedVersion, setLoadedVersion] = useState<string>();
  const [del, setDel] = useState<CareerRecord | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const importLock = useRef(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tOpp, setTOpp] = useState('');
  const [tJd, setTJd] = useState('');
  const [selectedExperienceIds, setSelectedExperienceIds] = useState<string[]>();
  const fileRef = useRef<HTMLInputElement>(null);
  const loadedFor = useRef<string | null>(null);
  const latestEditor = useRef({ selId, title, content });
  latestEditor.current = { selId, title, content };

  const selectSaved = async (record: CareerRecord) => {
    // Make the returned record available before selection; otherwise the
    // missing-selection effect can switch back to an old draft during refetch.
    await queryClient.cancelQueries({ queryKey: getListRecordsQueryKey() });
    queryClient.setQueryData<CareerRecord[]>(getListRecordsQueryKey(), (records = []) =>
      [record, ...records.filter(r => r.id !== record.id)]);
    if (selId) drafts.drafts.delete(selId);
    drafts.selected = record.id;
    loadedFor.current = null;
    setSelId(record.id);
  };

  const sel = q.items.find((r) => r.id === selId) ?? null;

  useEffect(() => {
    if ((!selId || !q.items.some(r => r.id === selId)) && q.items.length) setSelId(q.items[0].id);
  }, [q.items, selId]);

  useEffect(() => {
    if (sel && loadedFor.current !== sel.id) {
      loadedFor.current = sel.id;
      drafts.selected = sel.id;
      const recovered = drafts.drafts.get(sel.id);
      setTitle(recovered?.title ?? sel.title);
      setContent(recovered?.content ?? sel.content ?? '');
      setLoadedVersion(recovered ? recovered.version : sel.updatedAt);
    }
  }, [sel]);

  const dirty = !!sel && (title !== sel.title || content !== (sel.content ?? ''));
  const discardDraft = () => { if (selId) drafts.drafts.delete(selId); };
  useUnsavedChanges(dirty, discardDraft);

  // Write on each edit, not unmount: history navigation can unmount immediately.
  const editDraft = (nextTitle: string, nextContent: string) => {
    setTitle(nextTitle);
    setContent(nextContent);
    if (selId) {
      if (nextTitle === sel?.title && nextContent === (sel?.content ?? '')) drafts.drafts.delete(selId);
      else drafts.drafts.set(selId, { title: nextTitle, content: nextContent, version: loadedVersion });
    }
  };


  const newResume = () => {
    if (dirty && !confirm('Discard unsaved resume changes?')) return;
    create.mutate({ data: { kind: 'resume', title: 'Untitled resume', content: '' } }, {
      onSuccess: (r) => { selectSaved(r); toast({ title: 'Resume created' }); },
    });
  };

  const save = () => {
    if (!sel || !title.trim()) return;
    const submitted = { title, content };
    update.mutate({ id: sel.id, data: toInput(sel, { title: title.trim(), content, expectedUpdatedAt: loadedVersion }) }, {
      onSuccess: (saved) => {
        const current = latestEditor.current;
        if (current.selId === saved.id) {
          setLoadedVersion(saved.updatedAt);
          if (current.title === submitted.title && current.content === submitted.content) {
            drafts.drafts.delete(saved.id);
            setTitle(saved.title);
          } else {
            // A successful request only saved its snapshot, not edits made
            // while it was pending. Keep those edits recoverable.
            drafts.drafts.set(saved.id, { title: current.title, content: current.content, version: saved.updatedAt });
          }
        } else {
          const pending = drafts.drafts.get(saved.id);
          if (pending?.title === submitted.title && pending.content === submitted.content) drafts.drafts.delete(saved.id);
          else if (pending) drafts.drafts.set(saved.id, { ...pending, version: saved.updatedAt });
        }
        queryClient.setQueryData<CareerRecord[]>(getListRecordsQueryKey(), (records = []) => records.map(r => r.id === saved.id ? saved : r));
        toast({ title: 'Resume saved' });
      },
    });
  };

  const onFile = async (f: File | undefined) => {
    if (importLock.current) return;
    setImportErr(null);
    if (!f) return;
    if (dirty && !confirm('Discard unsaved resume changes before importing?')) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    const ct = TYPES[ext];
    if (!ct) return setImportErr('Only PDF, DOCX or TXT files can be imported.');
    if (f.size > 10 * 1024 * 1024) return setImportErr('That file is larger than 10 MB. Save a smaller PDF or paste the text instead.');
    if (f.size < 1) return setImportErr('That file is empty.');
    importLock.current = true;
    setImporting(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Could not read that file from your device.'));
        reader.readAsDataURL(f);
      });
      const out = await extract.mutateAsync({ data: { fileName: f.name.slice(0, 250), contentType: ct, dataBase64 } });
      if (!out.content?.trim()) throw new Error('No text could be extracted. Scanned PDFs need to be pasted as text.');
      const rec = store.create({ kind: 'resume', title: f.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Imported resume', content: out.content.slice(0, 50000), notes: `Imported from ${f.name} on ${new Date().toLocaleDateString()}. The file itself was not kept.` });
      invalidate();
      await selectSaved(rec);
      toast({ title: 'Imported', description: 'Review the extracted text. Formatting may need cleanup.' });
    } catch (e) {
      setImportErr(errMsg(e));
    } finally {
      importLock.current = false;
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const tailor = () => {
    if (!sel) return;
    if (dirty) { toast({title:'Save your changes first',description:'AI tailoring uses the last saved resume.',variant:'destructive'}); return; }
    coach.mutate({ data: { mode: 'resume', resumeId: sel.id, opportunityId: tOpp || undefined, jobDescription: tJd.trim() || undefined, selectedExperienceIds } }, {
      onSuccess: (r) => { setTailorOpen(false); selectSaved(r); toast({ title: 'Tailored draft saved', description: 'Review it carefully before sending.' }); },
    });
  };

  const exportTxt = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(title || 'resume').replace(/[^a-z0-9 _-]/gi,'').slice(0,100) || 'resume'}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    if (dirty) toast({ title: 'Exporting unsaved edits', description: 'Save to keep these changes.' });
    try {
      const { createResumePdf } = await import('@/lib/resume-pdf');
      const pdf = await createResumePdf(content);
      pdf.save(`${(title || 'resume').replace(/[^a-z0-9 _-]/gi,'').slice(0,100) || 'resume'}.pdf`);
    } catch (error) {
      toast({title:'PDF export failed',description:errMsg(error),variant:'destructive'});
    } finally { setExporting(false); }
  };

  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
    >
      <PageHeader
        eyebrow="Resumes"
        title="Plain text, built to pass"
        sub="Single-column text survives applicant tracking systems. Keep headings simple and lead every line with a result."
        actions={<>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void onFile(file); }} data-testid="input-file" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} data-testid="button-import"><Upload className="mr-1.5 h-4 w-4" />{importing ? 'Importing...' : 'Import'}</Button>
          <Button onClick={newResume} disabled={create.isPending} data-testid="button-new-resume"><Plus className="mr-1.5 h-4 w-4" />New resume</Button>
        </>}
      />
      {importErr && <div className="mb-4"><InlineError error={new Error(importErr)} /></div>}
      <button
        type="button"
        data-testid="resume-dropzone"
        disabled={importing}
        aria-busy={importing}
        aria-label="Import resume: drop a file or choose a PDF, DOCX or TXT up to 10 MB"
        onClick={() => fileRef.current?.click()}
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          if (!importLock.current) setDragging(true);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = importLock.current ? 'none' : 'copy';
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          if (importLock.current) return;
          if (e.dataTransfer.files.length !== 1) {
            setImportErr('Please drop one resume file at a time.');
            return;
          }
          void onFile(e.dataTransfer.files[0]);
        }}
        className={cn('mb-6 flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60',
          dragging ? 'border-foreground bg-accent' : 'border-border bg-card hover:border-muted-foreground')}
      >
        <Upload aria-hidden="true" className="pointer-events-none h-5 w-5 text-muted-foreground" />
        <span className="pointer-events-none text-sm" aria-live="polite">{importing ? 'Importing your resume…' : dragging ? 'Drop your resume here' : 'Drag and drop your resume here, or click to browse'}</span>
        <span className="pointer-events-none text-xs text-muted-foreground">One PDF, DOCX or TXT file · Up to 10 MB</span>
      </button>

      {q.isLoading || authLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.items.length === 0 ? (
        <EmptyState icon={<FileText className="h-4 w-4" />} title="No resumes yet" body="Start from a clean ATS-friendly template or import an existing PDF, DOCX or TXT file." action={<div className="flex gap-2"><Button variant="outline" onClick={() => fileRef.current?.click()}>Import file</Button><Button onClick={newResume}>Start from template</Button></div>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-1.5">
            {q.items.map((r) => (
              <button key={r.id} onClick={() => { if (r.id === selId) return; if (dirty && !confirm('Discard unsaved changes?')) return; discardDraft(); loadedFor.current = null; setSelId(r.id); }}
                className={cn('w-full rounded-lg border px-4 py-3 text-left transition-colors', r.id === selId ? 'bg-card border-foreground/25' : 'border-transparent hover:bg-card/60')} data-testid={`button-resume-${r.id}`}>
                <div className="truncate text-[13.5px]">{r.title}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">Edited {fmtDate(r.updatedAt)}</div>
              </button>
            ))}
          </div>
          {sel && (
            <Panel className="rise overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b p-3">
                <Label htmlFor="resume-title" className="sr-only">Resume title</Label>
                <Input id="resume-title" value={title} onChange={(e) => editDraft(e.target.value, content)} className="h-9 min-w-[180px] flex-1 border-transparent bg-transparent text-[15px] font-medium focus-visible:border-input" data-testid="input-resume-title" />
                <Button size="sm" variant="ghost" onClick={() => setTailorOpen(true)} data-testid="button-tailor"><Sparkles className="mr-1.5 h-3.5 w-3.5 text-signal" />Tailor with AI</Button>
                <Button size="sm" variant="ghost" onClick={exportTxt} data-testid="button-export-txt"><Download className="mr-1.5 h-3.5 w-3.5" />TXT</Button>
                <Button size="sm" variant="ghost" onClick={exportPdf} disabled={exporting} data-testid="button-export-pdf"><Download className="mr-1.5 h-3.5 w-3.5" />{exporting ? 'Exporting…' : 'PDF'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDel(sel)} aria-label="Delete resume" data-testid="button-delete-resume"><Trash2 className="h-3.5 w-3.5" /></Button>
                <Button size="sm" onClick={save} disabled={!dirty || update.isPending || !title.trim()} data-testid="button-save-resume">
                  {dirty ? <><Save className="mr-1.5 h-3.5 w-3.5" />{update.isPending ? 'Saving...' : 'Save'}</> : <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</>}
                </Button>
              </div>
              <InlineError error={update.error} />
              {sel.notes?.startsWith('VAULT MODEL CONTEXT —') && (
                <p className="border-b px-6 py-3 text-sm text-muted-foreground print:hidden" role="note" data-testid="resume-context-disclosure">
                  {sel.notes.split('\n\n')[0]}
                </p>
              )}
              <Label htmlFor="resume-content" className="sr-only">Resume content</Label>
              <Textarea id="resume-content" value={content} placeholder={TEMPLATE} onChange={(e) => editDraft(title, e.target.value)} spellCheck
                className="min-h-[640px] resize-y rounded-none border-0 bg-background/40 p-6 font-mono text-[13px] leading-[1.7] focus-visible:ring-0 md:p-10" data-testid="textarea-resume-content" />
              <div className="flex justify-between border-t px-4 py-2 font-mono text-[11px] text-muted-foreground">
                <span>{content.split(/\s+/).filter(Boolean).length} words</span><span>{content.length} / 50000</span>
              </div>
              {dirty && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Unsaved edits are kept as a draft on this device, even after a reload. Save to make them part of the resume.</p>}
            </Panel>
          )}
        </div>
      )}

      <div className="print-only">{content}</div>

      <Dialog open={tailorOpen} onOpenChange={(o) => { setTailorOpen(o); if (!o) coach.reset(); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-card sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-medium">Tailor "{sel?.title}"</DialogTitle>
            <DialogDescription>Creates a new resume draft aligned to a role. Your original stays untouched.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tailor-opportunity" className="text-[12px] font-normal text-muted-foreground">Tracked opportunity</Label>
              <Select value={tOpp} onValueChange={setTOpp}>
                <SelectTrigger id="tailor-opportunity" className="bg-background" data-testid="select-tailor-opportunity"><SelectValue placeholder={opps.items.length ? 'Choose a role' : 'No tracked opportunities'} /></SelectTrigger>
                <SelectContent>{opps.items.map((o) => <SelectItem key={o.id} value={o.id}>{o.title}{o.company ? ` / ${o.company}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tailor-jd" className="text-[12px] font-normal text-muted-foreground">Or paste a job description</Label>
              <Textarea id="tailor-jd" rows={6} value={tJd} onChange={(e) => setTJd(e.target.value)} className="bg-background" data-testid="textarea-tailor-jd" />
            </div>
            <VaultSourcePicker value={selectedExperienceIds} onChange={setSelectedExperienceIds} disabled={coach.isPending} />
            <AiNotice />
            <InlineError error={coach.error} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTailorOpen(false)}>Cancel</Button>
            <Button onClick={tailor} disabled={coach.isPending || (!tOpp && !tJd.trim())} data-testid="button-run-tailor">{coach.isPending ? 'Tailoring...' : 'Generate draft'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDelete record={del} onOpenChange={(o) => !o && setDel(null)} what="resume" onDeleted={() => { discardDraft(); drafts.selected = null; loadedFor.current = null; setSelId(null); }} />
    </div>
  );
}
