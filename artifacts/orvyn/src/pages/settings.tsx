import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Trash2, ShieldAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader, Panel, AiNotice, InlineError } from '@/components/kit';
import { errMsg, fmtDate } from '@/lib/orvyn';
import {
  STORAGE_KEY, readWorkspace, validateWorkspace, writeWorkspace, useProfile, useSaveProfile, useSaveStatus, type Workspace,
} from '@/lib/career-client';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const profile = useProfile();
  const saveProfile = useSaveProfile();
  const status = useSaveStatus();
  const [name, setName] = useState('');
  const [pending, setPending] = useState<{ ws: Workspace; file: string } | null>(null);
  const [importErr, setImportErr] = useState<unknown>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearErr, setClearErr] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!inited.current && profile.data) { inited.current = true; setName(profile.data.name ?? ''); }
  }, [profile.data]);

  let count = 0;
  try { count = readWorkspace().records.length; } catch { count = 0; }

  const exportJson = () => {
    try {
      const ws = readWorkspace();
      const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `orvyn-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast({ title: 'Backup downloaded', description: `${ws.records.length} records` });
    } catch (e) { toast({ title: 'Export failed', description: errMsg(e), variant: 'destructive' }); }
  };

  const onFile = async (f?: File) => {
    setImportErr(null);
    if (!f) return;
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error('That file is larger than 20 MB.');
      const ws = validateWorkspace(JSON.parse(await f.text()));
      setPending({ ws, file: f.name });
    } catch (e) { setImportErr(new Error(`Could not use that file: ${errMsg(e)}`)); }
  };

  const apply = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    try {
      let cur: Workspace;
      try { cur = readWorkspace(); } catch { if (mode === 'merge') throw new Error('Current data is unreadable, so it cannot be merged. Choose Replace instead.'); cur = { version: 1, savedAt: '', profile: {}, records: [] }; }
      let records = pending.ws.records;
      let added = records.length, updated = 0;
      if (mode === 'merge') {
        const map = new Map(cur.records.map((r) => [r.id, r]));
        added = 0;
        for (const r of pending.ws.records) {
          const ex = map.get(r.id);
          if (!ex) { map.set(r.id, r); added++; }
          else if (r.updatedAt > ex.updatedAt) { map.set(r.id, r); updated++; }
        }
        records = [...map.values()];
      }
      writeWorkspace({ version: 1, savedAt: '', profile: mode === 'merge' ? { name: cur.profile.name || pending.ws.profile.name } : pending.ws.profile, records });
      if (mode === 'replace') {
        window.localStorage.removeItem('orvyn:resume-drafts:v1');
        window.dispatchEvent(new Event('orvyn:reset-drafts'));
      }
      qc.invalidateQueries({ queryKey: ['local'] });
      inited.current = false;
      toast({ title: mode === 'merge' ? 'Backup merged' : 'Backup restored', description: mode === 'merge' ? `${added} added, ${updated} updated with newer copies. Nothing was deleted.` : `${records.length} records restored.` });
      setPending(null);
    } catch (e) { setImportErr(e); setPending(null); }
  };

  const clearAll = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem('orvyn:resume-drafts:v1');
      writeWorkspace({ version: 1, savedAt: '', profile: {}, records: [] });
      window.dispatchEvent(new Event('orvyn:reset-drafts'));
      qc.invalidateQueries({ queryKey: ['local'] });
      setName(''); setConfirmClear(false);
      toast({ title: 'All data cleared from this device' });
    } catch (e) { setClearErr(e); }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Settings" title="Your workspace" sub="No account, no sign-in. Everything lives in this browser on this device." />

      <Panel className="rise rise-1 p-6">
        <form onSubmit={(e) => { e.preventDefault(); saveProfile.mutate({ name }, { onSuccess: () => toast({ title: 'Name saved on this device' }) }); }}>
          <Label htmlFor="profile-name" className="text-[14px]">Your name <span className="text-muted-foreground">(optional)</span></Label>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Used only to greet you on the dashboard.</p>
          <div className="mt-3 flex gap-2">
            <Input id="profile-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="First name" className="bg-background" data-testid="input-profile-name" />
            <Button type="submit" variant="outline" disabled={saveProfile.isPending || name.trim() === (profile.data?.name ?? '')} data-testid="button-save-name">{saveProfile.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
          <div className="mt-3"><InlineError error={saveProfile.error} /></div>
        </form>
      </Panel>

      <Panel className="rise rise-2 mt-4 divide-y">
        <div className="p-6">
          <div className="text-[14px]">Where your work is saved</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {count} records are stored in this browser's local storage{status.state === 'saved' && status.at ? `, last confirmed ${fmtDate(status.at, true)}` : ''}.
            They are only available in this browser on this device. Another browser, another device or a private window will not see them.
            Clearing site data or browser history removes your work permanently, so download a backup regularly.
          </p>
          {status.state === 'error' && <div className="mt-3"><InlineError error={new Error(status.message)} /></div>}
          <div className="mt-4 flex items-start gap-2 rounded-lg border bg-background/40 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(38_80%_70%)]" />
            On a shared or public computer, anyone using this browser can open your workspace. Export a backup and clear data before you leave.
          </div>
        </div>
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-[14px]">Back up</div><p className="mt-1 text-[13px] text-muted-foreground">Download every record and your name as a JSON file.</p></div>
          <Button variant="outline" onClick={exportJson} data-testid="button-export-json"><Download className="mr-1.5 h-4 w-4" />Export JSON</Button>
        </div>
        <div className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-[14px]">Restore</div><p className="mt-1 text-[13px] text-muted-foreground">Load an Orvyn backup. It is checked before anything changes, and you choose merge or replace.</p></div>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} data-testid="input-restore-file" />
            <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-restore-json"><Upload className="mr-1.5 h-4 w-4" />Choose file</Button>
          </div>
          <div className="mt-3"><InlineError error={importErr} /></div>
        </div>
        <div className="p-6">
          <div className="text-[14px]">AI features</div>
          <AiNotice className="mt-1.5 text-[13px]" />
          <p className="mt-2 text-[12px] text-muted-foreground">Files you import are sent once for text extraction and are not kept by the server. Only the extracted text is saved, here.</p>
        </div>
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-[14px] text-destructive">Clear all data</div><p className="mt-1 text-[13px] text-muted-foreground">Removes every record, draft and your name from this browser.</p></div>
          <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => { setClearErr(null); setConfirmClear(true); }} data-testid="button-clear-data"><Trash2 className="mr-1.5 h-4 w-4" />Clear data</Button>
        </div>
      </Panel>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore "{pending?.file}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The file is valid and holds {pending?.ws.records.length} records{pending?.ws.savedAt ? `, saved ${fmtDate(pending.ws.savedAt, true)}` : ''}.
              Merge keeps everything here and adds new records, taking the newer copy when both exist. Replace discards the {count} records currently on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" className="text-destructive" onClick={() => apply('replace')} data-testid="button-restore-replace">Replace</Button>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); apply('merge'); }} data-testid="button-restore-merge">Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all {count} records from this device?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Export a backup first if you might want this work later.</AlertDialogDescription>
          </AlertDialogHeader>
          <InlineError error={clearErr} />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Keep my data</AlertDialogCancel>
            <Button variant="outline" onClick={exportJson}>Export first</Button>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); clearAll(); }} data-testid="button-confirm-clear">Clear everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
