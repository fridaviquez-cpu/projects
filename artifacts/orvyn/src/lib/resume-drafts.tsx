import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { reportStorageError } from './career-client';

export type ResumeDraft = { title: string; content: string; version?: string };
type DraftStore = { selected: string | null; drafts: Map<string, ResumeDraft>; reset: () => void };
const Context = createContext<DraftStore | null>(null);
const KEY = 'orvyn:resume-drafts:v1';

function load(): { selected: string | null; drafts: [string, ResumeDraft][]; blocked?: boolean } {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { selected: null, drafts: [] };
    const v = JSON.parse(raw);
    if (!v || !Array.isArray(v.drafts) || !v.drafts.every((entry: unknown) => {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') return false;
      const draft = entry[1];
      return draft && typeof draft.title === 'string' && typeof draft.content === 'string' &&
        (draft.version === undefined || typeof draft.version === 'string');
    })) throw new Error('Invalid saved drafts');
    return { selected: typeof v.selected === 'string' ? v.selected : null, drafts: v.drafts };
  } catch {
    reportStorageError('Saved resume drafts could not be read. The stored copy has not been changed.');
    return { selected: null, drafts: [], blocked: true };
  }
}

/** Unsaved resume edits survive navigation and reload: persisted to this browser on every edit. */
class PersistedMap extends Map<string, ResumeDraft> {
  owner?: { persist: () => void };
  set(k: string, v: ResumeDraft) { super.set(k, v); this.owner?.persist(); return this; }
  delete(k: string) { const r = super.delete(k); this.owner?.persist(); return r; }
}

export function ResumeDraftProvider({ children }: { children: ReactNode }) {
  const store = useMemo<DraftStore>(() => {
    const init = load();
    const drafts = new PersistedMap(init.drafts);
    let selected = init.selected;
    let blocked = !!init.blocked;
    const persist = () => {
      if (blocked) {
        reportStorageError('Existing resume drafts could not be read and have not been overwritten. Save the current resume explicitly or export it before leaving.');
        return;
      }
      try { window.localStorage.setItem(KEY, JSON.stringify({ selected, drafts: [...drafts.entries()] })); }
      catch { reportStorageError('Your latest resume edits could not be saved on this device. Keep this tab open and export the resume before leaving.'); }
    };
    drafts.owner = { persist };
    return {
      drafts,
      reset: () => { drafts.clear(); selected = null; blocked = false; },
      get selected() { return selected; },
      set selected(v: string | null) { selected = v; persist(); },
    };
  }, []);
  useEffect(() => {
    const reset = () => store.reset();
    window.addEventListener('orvyn:reset-drafts', reset);
    return () => window.removeEventListener('orvyn:reset-drafts', reset);
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useResumeDrafts() {
  const store = useContext(Context);
  if (!store) throw new Error('ResumeDraftProvider missing');
  return store;
}
