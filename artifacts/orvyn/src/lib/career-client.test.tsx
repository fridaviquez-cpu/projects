import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  checkStorage, KINDS, readWorkspace, STORAGE_KEY, store, useListRecords,
  useSaveStatus, validateWorkspace, writeWorkspace,
} from './career-client';
import { toInput, WorkspaceProvider } from './orvyn';
import { workspace } from '../test/fixtures';

describe('guest saved records', () => {
  it.each(KINDS)('creates, edits, deletes and undoes a %s without losing fields', (kind) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    const input = workspace().records.find((r) => r.kind === kind)!;
    const created = store.create(input);
    expect(store.list()).toEqual([created]);
    const updated = store.update(created.id, toInput(created, { title: 'Edited', content: '' }));
    expect(updated).toEqual({ ...created, title: 'Edited', content: '', updatedAt: '2026-03-01T12:00:00.001Z' });
    expect(updated).not.toHaveProperty('expectedUpdatedAt');
    const removed = store.remove(created.id);
    expect(store.list()).toEqual([]);
    store.restore(removed);
    expect(store.list()).toEqual([updated]);
    store.restore(removed);
    expect(store.list()).toEqual([updated]); // Undo is idempotent.
  });

  it('does not overwrite a newer record when an old delete is undone', () => {
    const original = store.create({ kind: 'resume', title: 'Original' });
    const removed = store.remove(original.id);
    store.restore(removed);
    const latest = store.update(original.id, toInput(original, { title: 'Newer edit' }));
    store.restore(removed);
    expect(store.list()).toEqual([latest]);
  });

  it('recovers all saved fields from a fresh module after reload', async () => {
    const saved = writeWorkspace(workspace());
    vi.resetModules();
    const reloaded = await import('./career-client');
    expect(reloaded.readWorkspace()).toEqual(saved);
  });

  it('preserves records and profile through JSON export/restore validation', () => {
    const saved = writeWorkspace(workspace());
    const exported = JSON.stringify(readWorkspace(), null, 2);
    window.localStorage.clear();
    writeWorkspace(validateWorkspace(JSON.parse(exported)));
    expect(readWorkspace().records).toEqual(saved.records);
    expect(readWorkspace().profile).toEqual(saved.profile);
  });

  it('rejects blank titles and operations on deleted records without writes', () => {
    const saved = writeWorkspace(workspace());
    expect(() => store.create({ kind: 'resume', title: ' ' })).toThrow('title');
    expect(() => store.update('missing', { kind: 'resume', title: 'No' })).toThrow('no longer exists');
    expect(() => store.remove('missing')).toThrow('already removed');
    expect(readWorkspace()).toEqual(saved);
  });
});

describe('storage failures preserve the previous saved copy', () => {
  it.each(['create', 'update', 'remove', 'restore'] as const)('reports quota failure during %s', (operation) => {
    writeWorkspace(workspace());
    const before = localStorage.getItem(STORAGE_KEY);
    const current = store.list()[0];
    const { result } = renderHook(() => useSaveStatus());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const actions = {
      create: () => store.create({ kind: 'resume', title: 'New' }),
      update: () => store.update(current.id, toInput(current, { title: 'Changed' })),
      remove: () => store.remove(current.id),
      restore: () => store.restore({ ...current, id: 'undone' }),
    };
    act(() => { expect(actions[operation]).toThrow('Browser storage is full'); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(result.current).toMatchObject({ state: 'error', message: expect.stringContaining('storage is full') });
  });

  it('reports blocked storage reads without claiming success', () => {
    const { result } = renderHook(() => useSaveStatus());
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    act(() => { expect(() => readWorkspace()).toThrow('blocking local storage'); });
    expect(result.current.state).toBe('error');
  });

  it('handles a blocked localStorage property and a blocked startup probe', () => {
    const { result } = renderHook(() => useSaveStatus());
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    act(() => {
      expect(() => readWorkspace()).toThrow('blocking local storage');
      expect(() => checkStorage()).not.toThrow();
    });
    expect(result.current.state).toBe('error');
  });

  it('detects writes the browser silently fails to retain', () => {
    const before = writeWorkspace(workspace());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    expect(() => store.remove(before.records[0].id)).toThrow('Write could not be confirmed');
    expect(readWorkspace()).toEqual(before);
  });

  it.each(['{broken', JSON.stringify({ version: 99, records: [] })])('never replaces unreadable stored data: %s', (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(() => readWorkspace()).toThrow('has not been changed');
    expect(() => store.create({ kind: 'resume', title: 'New' })).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('returns to confirmed saved status when storage works again', () => {
    const { result } = renderHook(() => useSaveStatus());
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    act(() => { expect(() => writeWorkspace(workspace())).toThrow('Could not save'); });
    expect(result.current.state).toBe('error');
    blocked.mockRestore();
    act(() => checkStorage());
    expect(result.current.state).toBe('saved');
    expect(localStorage.getItem('orvyn:probe')).toBeNull();
  });
});

describe('restore validation', () => {
  it.each([
    ['not an object', null],
    ['unknown version', { ...workspace(), version: 2 }],
    ['missing list', { version: 1 }],
    ['duplicate IDs', { ...workspace(), records: [workspace().records[0], workspace().records[0]] }],
    ['unknown kind', { ...workspace(), records: [{ ...workspace().records[0], kind: 'unknown' }] }],
    ['unsafe URL', { ...workspace(), records: [{ ...workspace().records[0], url: 'javascript:alert(1)' }] }],
    ['invalid date', { ...workspace(), records: [{ ...workspace().records[0], updatedAt: 'yesterday' }] }],
    ['invalid answers', { ...workspace(), records: [{ ...workspace().records[0], answers: [0] }] }],
    ['oversized field', { ...workspace(), records: [{ ...workspace().records[0], content: 'x'.repeat(100001) }] }],
  ])('rejects %s before changing storage', (_label, invalid) => {
    const saved = writeWorkspace(workspace());
    expect(() => writeWorkspace(invalid as never)).toThrow();
    expect(readWorkspace()).toEqual(saved);
  });
});

describe('simultaneous tabs', () => {
  it('rejects stale edits and edits after deletion while retaining the winning copy', () => {
    const record = store.create({ kind: 'resume', title: 'Base' });
    const tabA = store.list()[0], tabB = store.list()[0];
    const winner = store.update(record.id, toInput(tabA, { title: 'Tab A' }));
    expect(() => store.update(record.id, toInput(tabB, { title: 'Tab B' }))).toThrow('changed in another tab');
    expect(store.list()).toEqual([winner]);
    store.remove(record.id);
    expect(() => store.update(record.id, toInput(winner))).toThrow('deleted in another tab');
  });

  it('reads the latest workspace before unrelated tab writes', () => {
    const first = store.create({ kind: 'resume', title: 'A' });
    const second = store.create({ kind: 'goal', title: 'B' });
    store.update(first.id, toInput(first, { title: 'A edited' }));
    expect(store.list().find((r) => r.id === second.id)).toEqual(second);
    expect(store.list().find((r) => r.id === first.id)?.title).toBe('A edited');
  });

  it('refreshes mounted queries for workspace storage events and browser clear', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}><WorkspaceProvider>{children}</WorkspaceProvider></QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useListRecords(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    const otherTab = store.create({ kind: 'resume', title: 'Other tab' });
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
    expect(result.current.data).toEqual([]);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })));
    await waitFor(() => expect(result.current.data).toEqual([otherTab]));
    localStorage.clear();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    await waitFor(() => expect(result.current.data).toEqual([]));
    unmount();
    qc.clear();
  });
});
