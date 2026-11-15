import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResumeDraftProvider, useResumeDrafts } from './resume-drafts';
import { useSaveStatus } from './career-client';
import { DRAFT_KEY } from '../test/fixtures';

const draft = { title: 'Unsaved résumé', content: 'First line\nSecond line — 你好', version: '2026-01-01T00:00:00.000Z' };
const mount = () => renderHook(() => ({ drafts: useResumeDrafts(), status: useSaveStatus() }), { wrapper: ResumeDraftProvider });

describe('recoverable resume edits', () => {
  it('persists every edit, selection and deletion immediately, and recovers on remount', () => {
    const first = mount();
    act(() => {
      first.result.current.drafts.selected = 'resume-1';
      first.result.current.drafts.drafts.set('resume-1', draft);
      first.result.current.drafts.drafts.set('resume-2', { title: 'Second', content: '' });
    });
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toEqual({
      selected: 'resume-1', drafts: [['resume-1', draft], ['resume-2', { title: 'Second', content: '' }]],
    });
    first.unmount();
    const second = mount();
    expect(second.result.current.drafts.selected).toBe('resume-1');
    expect(second.result.current.drafts.drafts.get('resume-1')).toEqual(draft);
    act(() => {
      second.result.current.drafts.drafts.set('resume-1', { ...draft, content: 'Latest typing' });
      second.result.current.drafts.drafts.delete('resume-2');
    });
    second.unmount();
    const third = mount();
    expect([...third.result.current.drafts.drafts]).toEqual([['resume-1', { ...draft, content: 'Latest typing' }]]);
    act(() => { third.result.current.drafts.drafts.delete('resume-1'); third.result.current.drafts.selected = null; });
    third.unmount();
    expect([...mount().result.current.drafts.drafts]).toEqual([]);
  });

  it.each([
    '{broken',
    JSON.stringify({ drafts: [['id', { title: 123, content: 'text' }]] }),
    JSON.stringify({ drafts: [['id', { title: 'text', content: 'text', version: 123 }]] }),
  ])('preserves unreadable saved drafts rather than overwriting them', (raw) => {
    localStorage.setItem(DRAFT_KEY, raw);
    const { result } = mount();
    expect(result.current.status.state).toBe('error');
    act(() => {
      result.current.drafts.drafts.set('new', draft);
      result.current.drafts.selected = 'new';
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBe(raw);
    expect(result.current.drafts.drafts.get('new')).toEqual(draft);
    expect(result.current.status.message).toContain('have not been overwritten');
  });

  it.each(['QuotaExceededError', 'SecurityError'])('keeps edits in memory and warns when writes fail with %s', (name) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selected: 'old', drafts: [['old', draft]] }));
    const before = localStorage.getItem(DRAFT_KEY);
    const { result } = mount();
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied', name); });
    act(() => { result.current.drafts.drafts.set('old', { ...draft, content: 'Not saved yet' }); });
    expect(result.current.drafts.drafts.get('old')?.content).toBe('Not saved yet');
    expect(result.current.status.message).toContain('Keep this tab open');
    expect(localStorage.getItem(DRAFT_KEY)).toBe(before);
    blocked.mockRestore();
    act(() => { result.current.drafts.drafts.set('old', { ...draft, content: 'Retry saved' }); });
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!).drafts[0][1].content).toBe('Retry saved');
  });

  it('does not overwrite drafts when the initial storage read is blocked', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selected: 'old', drafts: [['old', draft]] }));
    const before = localStorage.getItem(DRAFT_KEY);
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const { result } = mount();
    blocked.mockRestore();
    act(() => { result.current.drafts.drafts.set('new', draft); });
    expect(localStorage.getItem(DRAFT_KEY)).toBe(before);
    expect(result.current.status.state).toBe('error');
  });

  it('resets live state after clear-all and does not resurrect old drafts', () => {
    localStorage.setItem(DRAFT_KEY, '{broken');
    const { result, unmount } = mount();
    act(() => {
      result.current.drafts.drafts.set('old', draft);
      result.current.drafts.selected = 'old';
      localStorage.removeItem(DRAFT_KEY);
      window.dispatchEvent(new Event('orvyn:reset-drafts'));
    });
    expect(result.current.drafts.selected).toBeNull();
    expect(result.current.drafts.drafts.size).toBe(0);
    act(() => { result.current.drafts.drafts.set('new', draft); });
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!).drafts).toEqual([['new', draft]]);
    unmount();
    expect([...mount().result.current.drafts.drafts.keys()]).toEqual(['new']);
  });
});
