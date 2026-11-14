import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import {
  STORAGE_KEY, checkStorage, getListRecordsQueryKey, getGetSummaryQueryKey, store, useListRecords, useProfile,
  type CareerRecord, type RecordInput, type RecordInputKind,
} from '@/lib/career-client';

/** Local workspace: no accounts. "user" is only the optional profile name. */
export type LocalUser = { id: 'local'; firstName?: string; lastName?: string; email?: string; profileImageUrl?: string };
type WorkspaceCtx = { user: LocalUser | null; isLoading: boolean; isAuthenticated: boolean };

const Ctx = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const profile = useProfile();
  useEffect(() => {
    checkStorage();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) { checkStorage(); qc.invalidateQueries({ queryKey: ['local'] }); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [qc]);
  const value = useMemo<WorkspaceCtx>(() => ({
    user: { id: 'local', firstName: profile.data?.name },
    isLoading: false,
    isAuthenticated: true,
  }), [profile.data?.name]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('WorkspaceProvider missing');
  return c;
}

export function useRecords(kind?: RecordInputKind) {
  const q = useListRecords();
  const items = useMemo(() => {
    const all = q.data ?? [];
    const f = kind ? all.filter((r) => r.kind === kind) : all;
    return [...f].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [q.data, kind]);
  return { ...q, items, all: q.data ?? [] };
}

export function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: getListRecordsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
  };
}

type MOpts = { onSuccess?: (r: CareerRecord) => void; onError?: (e: unknown) => void };
export function useRecordMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['local'] });
  const create = useMutation({ mutationFn: async ({ data }: { data: RecordInput }) => store.create(data), onSuccess: done });
  const update = useMutation({ mutationFn: async ({ id, data }: { id: string; data: RecordInput }) => store.update(id, data), onSuccess: done });
  const remove = useMutation({ mutationFn: async ({ id }: { id: string }) => store.remove(id), onSuccess: done });
  const restore = useMutation({ mutationFn: async (r: CareerRecord) => store.restore(r), onSuccess: done });
  return { create, update, remove, restore };
}
export type { MOpts };

const KEYS: (keyof RecordInput)[] = [
  'kind', 'title', 'company', 'category', 'status', 'description', 'notes', 'deadline', 'interviewAt',
  'location', 'salary', 'contact', 'url', 'skills', 'results', 'startDate', 'endDate', 'content',
  'opportunityId', 'officialStrengths', 'answers',
];

/** Strip stored-only fields so a record can be written back as a full input patch. */
export function toInput(r: CareerRecord, patch: Partial<RecordInput> = {}): RecordInput {
  const out: Record<string, unknown> = {};
  const merged = { ...r, ...patch } as Record<string, unknown>;
  for (const k of KEYS) {
    const v = merged[k];
    if (v !== null && v !== undefined) out[k] = v;
  }
  if (r.updatedAt) out.expectedUpdatedAt = patch.expectedUpdatedAt ?? r.updatedAt;
  return out as unknown as RecordInput;
}

export function errMsg(e: unknown) {
  if (!e) return 'Something went wrong.';
  const anyE = e as { status?: number; data?: unknown; message?: string };
  const data = anyE.data as { error?: string; message?: string } | undefined;
  const m = data?.error || data?.message || anyE.message || String(e);
  return m.replace(/^HTTP \d+ [^:]*:?\s*/, '') || m;
}

export function fmtDate(s?: string | null, withTime = false) {
  if (!s) return '';
  const d = parseISO(s);
  if (!isValid(d)) return s;
  return format(d, withTime && s.includes('T') ? 'MMM d, h:mm a' : 'MMM d, yyyy');
}

export function daysUntil(s?: string | null) {
  if (!s) return null;
  const d = parseISO(s);
  if (!isValid(d)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86400000);
}

export function relLabel(n: number | null) {
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

export function displayName(u: LocalUser | null) {
  if (!u) return '';
  return [u.firstName, u.lastName].filter(Boolean).join(' ');
}
