import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mutateAsync = vi.fn();
vi.mock('@workspace/api-client-react', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useReadCareerScreenshotBatch: () => ({ mutateAsync }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { ScreenshotBatchDialog } from './screenshot-batch';
import { store } from '@/lib/career-client';
import type { FieldDef } from './kit';

const FIELDS: FieldDef[] = [
  { name: 'title', label: 'Role', required: true },
  { name: 'company', label: 'Company', half: true },
  { name: 'status', label: 'Stage', type: 'select', options: ['saved', 'applied', 'interview'].map((v) => ({ value: v, label: v })), half: true },
  { name: 'deadline', label: 'Deadline', type: 'date', half: true },
];

const png = (n: string) => new File([new Uint8Array([1, 2, 3, 4])], n, { type: 'image/png' });
const ready = (i: number, fileName: string, fields: Record<string, string>) => ({ index: i, fileName, status: 'ready', draft: { fields, extractedText: '', warnings: [] } });

function mount(onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><ScreenshotBatchDialog open onOpenChange={onOpenChange} target="opportunity" fields={FIELDS} defaults={{ status: 'saved' }} /></QueryClientProvider>);
  return { onOpenChange };
}
const choose = (files: File[]) => fireEvent.change(screen.getByTestId('screenshot-batch-input'), { target: { files } });

beforeEach(() => {
  mutateAsync.mockReset();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
});

describe('ScreenshotBatchDialog', () => {
  it.each([5, 4])('reads %i screenshots automatically and saves the same number of distinct records without typing', async (n) => {
    mutateAsync.mockImplementation(async ({ data }) => ({
      items: data.images.map((im: { fileName: string }, i: number) => ready(i, im.fileName, { title: `Role ${i}`, company: `Co ${i}`, status: 'applied', deadline: '2025-03-0' + (i + 1) })),
    }));
    mount();
    expect(screen.getByTestId('screenshot-batch-privacy').textContent).toMatch(/sends them to AI/);
    choose(Array.from({ length: n }, (_, i) => png(`shot-${i}.png`)));
    await waitFor(() => expect(screen.getByTestId('button-save-batch').textContent).toBe(`Save ${n} opportunities`));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0][0].data.images).toHaveLength(n);
    expect((screen.getByTestId('input-batch-2-company') as HTMLInputElement).value).toBe('Co 2');
    const spy = vi.spyOn(store, 'createMany');
    fireEvent.click(screen.getByTestId('button-save-batch'));
    fireEvent.click(screen.getByTestId('button-save-batch'));
    expect(spy).toHaveBeenCalledTimes(1);
    const saved = store.list().filter((r) => r.kind === 'opportunity');
    expect(saved).toHaveLength(n);
    expect(new Set(saved.map((r) => r.title)).size).toBe(n);
    expect(saved.find((r) => r.title === 'Role 1')).toMatchObject({ company: 'Co 1', status: 'applied', deadline: '2025-03-02' });
  });

  it('rejects a sixth screenshot with a clear message', async () => {
    mutateAsync.mockImplementation(async ({ data }) => ({ items: data.images.map((im: { fileName: string }, i: number) => ready(i, im.fileName, { title: 'X' + i })) }));
    mount();
    choose(Array.from({ length: 6 }, (_, i) => png(`s${i}.png`)));
    expect(screen.getByTestId('text-error').textContent).toMatch(/Only 5 screenshots/);
    expect(screen.getByTestId('text-batch-count').textContent).toBe('5/5');
    await waitFor(() => expect(screen.getByTestId('button-save-batch').textContent).toBe('Save 5 opportunities'));
  });

  it('keeps ready drafts on per-item errors, retries only the failed image, and uses a fallback title', async () => {
    mutateAsync.mockResolvedValueOnce({ items: [ready(0, 'a.png', { company: 'Northwind' }), { index: 1, fileName: 'b.png', status: 'error', error: 'Too blurry' }] });
    mount();
    choose([png('a.png'), png('b.png')]);
    await screen.findByText('Too blurry');
    expect((screen.getByTestId('input-batch-0-title') as HTMLInputElement).value).toBe('Imported opportunity');
    fireEvent.change(screen.getByTestId('input-batch-0-title'), { target: { value: 'My edit' } });
    mutateAsync.mockResolvedValueOnce({ items: [ready(0, 'b.png', { title: 'Second' })] });
    fireEvent.click(screen.getByTestId('button-batch-retry-1'));
    await waitFor(() => expect(screen.getByTestId('button-save-batch').textContent).toBe('Save 2 opportunities'));
    expect(mutateAsync.mock.calls[1][0].data.images).toHaveLength(1);
    expect((screen.getByTestId('input-batch-0-title') as HTMLInputElement).value).toBe('My edit');
  });

  it('ignores late results after cancel', async () => {
    let resolve!: (v: unknown) => void;
    mutateAsync.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { onOpenChange } = mount();
    choose([png('a.png')]);
    expect(screen.getByTestId('button-save-batch')).toHaveProperty('disabled', true);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('button-cancel-batch'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => resolve({ items: [ready(0, 'a.png', { title: 'Late' })] }));
    expect(store.list()).toHaveLength(0);
  });
});
