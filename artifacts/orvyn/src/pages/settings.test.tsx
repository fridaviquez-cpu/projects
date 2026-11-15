import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Settings from './settings';
import { readWorkspace, STORAGE_KEY, writeWorkspace, type Workspace } from '../lib/career-client';
import { ResumeDraftProvider, useResumeDrafts } from '../lib/resume-drafts';
import { DRAFT_KEY, workspace } from '../test/fixtures';

// Notifications are not relevant to persistence; leave real controls, dialogs,
// queries, file validation and storage operations mounted.
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const clients: QueryClient[] = [];
afterEach(() => { clients.splice(0).forEach((qc) => qc.clear()); });

function mountSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(qc);
  let drafts!: ReturnType<typeof useResumeDrafts>;
  function CaptureDrafts() { drafts = useResumeDrafts(); return null; }
  render(
    <QueryClientProvider client={qc}>
      <ResumeDraftProvider><CaptureDrafts /><Settings /></ResumeDraftProvider>
    </QueryClientProvider>,
  );
  return { get drafts() { return drafts; } };
}

async function chooseFile(text: string) {
  const file = new File([text], 'orvyn-backup.json', { type: 'application/json' });
  // jsdom's File lacks text(); supply the browser API, not parsing behavior.
  Object.defineProperty(file, 'text', { value: async () => text });
  fireEvent.change(screen.getByTestId('input-restore-file'), { target: { files: [file] } });
}

async function restore(ws: Workspace, mode: 'merge' | 'replace') {
  await chooseFile(JSON.stringify(ws));
  fireEvent.click(await screen.findByTestId(`button-restore-${mode}`));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

describe('Settings backup and recovery controls', () => {
  it.each([
    '{not JSON',
    JSON.stringify({ version: 2, records: [] }),
    JSON.stringify({ ...workspace(), records: [{ id: 'bad', kind: 'resume' }] }),
  ])('rejects invalid restore files without touching records or drafts', async (text) => {
    writeWorkspace(workspace());
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selected: null, drafts: [] }));
    const recordsBefore = localStorage.getItem(STORAGE_KEY), draftsBefore = localStorage.getItem(DRAFT_KEY);
    mountSettings();
    await chooseFile(text);
    await screen.findByText(/Could not use that file:/);
    expect(screen.queryByTestId('button-restore-replace')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(recordsBefore);
    expect(localStorage.getItem(DRAFT_KEY)).toBe(draftsBefore);
  });

  it('merges only newer duplicates, adds missing IDs, keeps local-only records, profile and drafts', async () => {
    const local = workspace();
    writeWorkspace(local);
    const incoming = workspace();
    incoming.profile.name = 'Backup name';
    incoming.records[0] = { ...incoming.records[0], title: 'Newer backup', updatedAt: '2026-04-01T00:00:00.000Z' };
    incoming.records[1] = { ...incoming.records[1], title: 'Older backup', updatedAt: '2025-01-01T00:00:00.000Z' };
    incoming.records[2] = { ...incoming.records[2], title: 'Equal timestamp' };
    incoming.records = incoming.records.slice(0, 3);
    incoming.records.push({ ...local.records[0], id: 'new', title: 'New record' });
    const ui = mountSettings();
    act(() => {
      ui.drafts.selected = 'record-2';
      ui.drafts.drafts.set('record-2', { title: 'Draft', content: 'Keep typing' });
    });
    const draftsBefore = localStorage.getItem(DRAFT_KEY);
    await restore(incoming, 'merge');
    expect(readWorkspace().records).toEqual([incoming.records[0], ...local.records.slice(1), incoming.records[3]]);
    expect(readWorkspace().profile).toEqual(local.profile);
    expect(localStorage.getItem(DRAFT_KEY)).toBe(draftsBefore);
    expect(ui.drafts.drafts.size).toBe(1);
  });

  it('uses the backup profile on merge when no local name exists', async () => {
    writeWorkspace({ ...workspace(), profile: {} });
    mountSettings();
    await restore(workspace(), 'merge');
    expect(readWorkspace().profile).toEqual(workspace().profile);
  });

  it('replaces records and profile and resets both persisted and live drafts', async () => {
    writeWorkspace(workspace());
    const ui = mountSettings();
    act(() => {
      ui.drafts.selected = 'record-2';
      ui.drafts.drafts.set('record-2', { title: 'Old', content: 'Old draft' });
    });
    const incoming = { ...workspace(), profile: { name: 'Replacement' }, records: workspace().records.slice(0, 1) };
    await restore(incoming, 'replace');
    expect(readWorkspace().records).toEqual(incoming.records);
    expect(readWorkspace().profile).toEqual(incoming.profile);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(ui.drafts.selected).toBeNull();
    expect(ui.drafts.drafts.size).toBe(0);
  });

  it('clears all records, profile and live drafts only after confirmation', async () => {
    const saved = writeWorkspace(workspace());
    localStorage.setItem('unrelated-app', 'keep');
    const ui = mountSettings();
    act(() => {
      ui.drafts.selected = 'record-2';
      ui.drafts.drafts.set('record-2', { title: 'Draft', content: 'Unsaved' });
    });
    fireEvent.click(screen.getByTestId('button-clear-data'));
    expect(readWorkspace()).toEqual(saved);
    fireEvent.click(screen.getByText('Keep my data'));
    expect(ui.drafts.drafts.size).toBe(1);
    fireEvent.click(screen.getByTestId('button-clear-data'));
    fireEvent.click(screen.getByTestId('button-confirm-clear'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(readWorkspace().records).toEqual([]);
    expect(readWorkspace().profile).toEqual({});
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(ui.drafts.drafts.size).toBe(0);
    expect(ui.drafts.selected).toBeNull();
    // Later typing must not persist any pre-clear drafts.
    act(() => { ui.drafts.drafts.set('fresh', { title: 'New', content: '' }); });
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!).drafts).toEqual([['fresh', { title: 'New', content: '' }]]);
    expect(localStorage.getItem('unrelated-app')).toBe('keep');
  });

  it('rejects merging unreadable current data but allows an explicit replacement', async () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    mountSettings();
    await restore(workspace(), 'merge');
    await screen.findByText(/Current data is unreadable/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
    await restore(workspace(), 'replace');
    expect(readWorkspace().records).toEqual(workspace().records);
  });

  it('leaves records and drafts intact if a restore exceeds storage quota', async () => {
    writeWorkspace(workspace());
    const before = localStorage.getItem(STORAGE_KEY);
    const ui = mountSettings();
    act(() => { ui.drafts.drafts.set('record-2', { title: 'Keep', content: 'Draft' }); });
    const draftsBefore = localStorage.getItem(DRAFT_KEY);
    await chooseFile(JSON.stringify({ ...workspace(), records: [] }));
    const replace = await screen.findByTestId('button-restore-replace');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    fireEvent.click(replace);
    await screen.findAllByText(/Browser storage is full/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(localStorage.getItem(DRAFT_KEY)).toBe(draftsBefore);
    expect(ui.drafts.drafts.size).toBe(1);
  });

  it('downloads a real JSON backup and restores every saved field without loss', async () => {
    const saved = writeWorkspace(workspace());
    let downloaded!: Blob;
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL(blob: Blob) { downloaded = blob; return 'blob:test-backup'; }
      static revokeObjectURL() {}
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mountSettings();
    fireEvent.click(screen.getByTestId('button-export-json'));
    expect(click).toHaveBeenCalledOnce();
    expect(downloaded.type).toBe('application/json');
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(downloaded);
    });
    expect(JSON.parse(text)).toEqual(saved);
    writeWorkspace({ ...workspace(), profile: {}, records: [] });
    await chooseFile(text);
    fireEvent.click(await screen.findByTestId('button-restore-replace'));
    await waitFor(() => expect(readWorkspace().records).toEqual(saved.records));
    expect(readWorkspace().profile).toEqual(saved.profile);
  });
});
