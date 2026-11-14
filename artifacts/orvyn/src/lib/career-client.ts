/**
 * Local career data adapter. Every record lives in this browser's localStorage
 * under a versioned key. Failures are thrown, never swallowed, so the UI can
 * show them. Cross-tab changes arrive via the `storage` event.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useAssistCareer, type CareerEvidence, type CareerAssistInputMode } from '@workspace/api-client-react';

export type RecordInputKind = 'opportunity' | 'experience' | 'resume' | 'interview' | 'dna' | 'goal' | 'insight';
export type RecordInputStatus =
  | 'saved' | 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected' | 'withdrawn' | 'active' | 'completed';

export type RecordInput = {
  kind: RecordInputKind;
  title: string;
  company?: string;
  category?: string;
  status?: RecordInputStatus;
  description?: string;
  notes?: string;
  deadline?: string;
  interviewAt?: string;
  location?: string;
  salary?: string;
  contact?: string;
  url?: string;
  skills?: string;
  results?: string;
  startDate?: string;
  endDate?: string;
  content?: string;
  opportunityId?: string;
  officialStrengths?: string;
  answers?: number[];
  expectedUpdatedAt?: string;
};

export type CareerRecord = Omit<RecordInput, 'expectedUpdatedAt'> & { id: string; createdAt: string; updatedAt: string };

export type Profile = { name?: string };
export type Workspace = { version: 1; savedAt: string; profile: Profile; records: CareerRecord[] };

export const STORAGE_KEY = 'orvyn:workspace:v1';
export const KINDS: RecordInputKind[] = ['opportunity', 'experience', 'resume', 'interview', 'dna', 'goal', 'insight'];

/* ---------- save status (drives the sidebar footer) ---------- */
export type SaveStatus = { state: 'checking' | 'saved' | 'error'; message?: string; at?: string };
let status: SaveStatus = { state: 'checking' };
const listeners = new Set<() => void>();
function setStatus(s: SaveStatus) {
  if (status.state === s.state && status.message === s.message && status.at === s.at) return;
  status = s; listeners.forEach((l) => l());
}
export function reportStorageError(message: string) { setStatus({ state: 'error', message }); }
export function useSaveStatus() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status);
}

/* ---------- storage ---------- */
function empty(): Workspace { return { version: 1, savedAt: new Date().toISOString(), profile: {}, records: [] }; }

export function validateWorkspace(raw: unknown): Workspace {
  if (!raw || typeof raw !== 'object') throw new Error('Not an Orvyn workspace file.');
  const w = raw as Record<string, unknown>;
  if (w.version !== 1) throw new Error(`Unsupported workspace version: ${String(w.version)}.`);
  if (!Array.isArray(w.records)) throw new Error('Workspace has no records list.');
  if (w.records.length > 10000) throw new Error('Workspace contains too many records.');
  const seen = new Set<string>();
  const stringFields = ['title', 'company', 'category', 'status', 'description', 'notes', 'deadline', 'interviewAt', 'location', 'salary', 'contact', 'url', 'skills', 'results', 'startDate', 'endDate', 'content', 'opportunityId', 'officialStrengths'];
  const records = w.records.map((r, i) => {
    const x = r as Record<string, unknown>;
    if (!x || typeof x !== 'object') throw new Error(`Record ${i + 1} is not an object.`);
    if (typeof x.id !== 'string' || !x.id || x.id.length > 100) throw new Error(`Record ${i + 1} has an invalid id.`);
    if (seen.has(x.id)) throw new Error(`Record ${i + 1} repeats another record's id.`);
    seen.add(x.id);
    if (!KINDS.includes(x.kind as RecordInputKind)) throw new Error(`Record ${i + 1} has unknown kind "${String(x.kind)}".`);
    if (typeof x.title !== 'string' || !x.title.trim()) throw new Error(`Record ${i + 1} has no title.`);
    for (const key of stringFields) {
      if (x[key] !== undefined && (typeof x[key] !== 'string' || (x[key] as string).length > 100000))
        throw new Error(`Record ${i + 1} has invalid ${key}.`);
    }
    if (x.url) {
      try { if (!['https:', 'http:'].includes(new URL(x.url as string).protocol)) throw new Error(); }
      catch { throw new Error(`Record ${i + 1} needs a valid HTTP or HTTPS posting URL.`); }
    }
    for (const key of ['createdAt', 'updatedAt', 'deadline', 'interviewAt', 'startDate', 'endDate']) {
      if (x[key] !== undefined && x[key] !== '' && (typeof x[key] !== 'string' || !Number.isFinite(Date.parse(x[key] as string))))
        throw new Error(`Record ${i + 1} has an invalid ${key} date.`);
    }
    if (x.answers !== undefined && !(Array.isArray(x.answers) && x.answers.length === 12 && x.answers.every((n) => Number.isInteger(n) && n >= 1 && n <= 5))) throw new Error(`Record ${i + 1} has invalid answers.`);
    const now = new Date().toISOString();
    const record: Record<string, unknown> = { id: x.id, kind: x.kind };
    for (const key of stringFields) if (x[key] !== undefined) record[key] = x[key];
    if (x.answers !== undefined) record.answers = x.answers;
    return { ...record, createdAt: typeof x.createdAt === 'string' ? x.createdAt : now, updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : now } as CareerRecord;
  });
  const p = (w.profile && typeof w.profile === 'object' ? w.profile : {}) as Profile;
  return { version: 1, savedAt: typeof w.savedAt === 'string' ? w.savedAt : new Date().toISOString(), profile: { name: typeof p.name === 'string' ? p.name : undefined }, records };
}

export function readWorkspace(): Workspace {
  let raw: string | null;
  try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) {
    const err = new Error('This browser is blocking local storage, so nothing can be saved. Check private-mode or site-data settings.');
    setStatus({ state: 'error', message: err.message }); throw err; void e;
  }
  if (!raw) return empty();
  try { return validateWorkspace(JSON.parse(raw)); } catch (e) {
    const err = new Error(`Saved data on this device could not be read (${(e as Error).message}). It has not been changed. Export or clear it in Settings.`);
    setStatus({ state: 'error', message: err.message });
    throw err;
  }
}

export function writeWorkspace(w: Workspace) {
  const next = { ...validateWorkspace(w), savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const back = window.localStorage.getItem(STORAGE_KEY);
    if (back !== JSON.stringify(next)) throw new Error('Write could not be confirmed.');
  } catch (e) {
    const name = (e as Error).name;
    const msg = name === 'QuotaExceededError' ? 'Browser storage is full. Export your data, then remove large resumes or sessions.' : `Could not save on this device: ${(e as Error).message}`;
    setStatus({ state: 'error', message: msg });
    throw new Error(msg);
  }
  setStatus({ state: 'saved', at: next.savedAt });
  return next;
}

export function checkStorage() {
  try {
    const probe = 'orvyn:probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    readWorkspace();
    setStatus({ state: 'saved', at: new Date().toISOString() });
  } catch (e) {
    if (status.state !== 'error') setStatus({ state: 'error', message: (e as Error).message });
  }
}

function uid() {
  return (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
}

function clean(input: Partial<RecordInput>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === 'expectedUpdatedAt') continue;
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v === '' && k !== 'content') continue;
    out[k] = v;
  }
  return out as Partial<RecordInput>;
}

export const store = {
  list(): CareerRecord[] { return readWorkspace().records; },
  create(input: RecordInput): CareerRecord {
    const w = readWorkspace();
    if (!input.title?.trim()) throw new Error('A title is required.');
    const now = new Date().toISOString();
    const r = { ...clean(input), id: uid(), createdAt: now, updatedAt: now } as CareerRecord;
    writeWorkspace({ ...w, records: [r, ...w.records] });
    return r;
  },
  update(id: string, input: RecordInput): CareerRecord {
    const w = readWorkspace();
    const cur = w.records.find((r) => r.id === id);
    if (!cur) throw new Error('This record no longer exists. It may have been deleted in another tab.');
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== cur.updatedAt)
      throw new Error('This record changed in another tab. Reload the page to see the latest version before saving.');
    let now = new Date().toISOString();
    if (now <= cur.updatedAt) now = new Date(new Date(cur.updatedAt).getTime() + 1).toISOString();
    const r = { ...clean(input), id, createdAt: cur.createdAt, updatedAt: now } as CareerRecord;
    writeWorkspace({ ...w, records: w.records.map((x) => (x.id === id ? r : x)) });
    return r;
  },
  remove(id: string): CareerRecord {
    const w = readWorkspace();
    const cur = w.records.find((r) => r.id === id);
    if (!cur) throw new Error('This record was already removed.');
    writeWorkspace({ ...w, records: w.records.filter((r) => r.id !== id) });
    return cur;
  },
  restore(r: CareerRecord) {
    const w = readWorkspace();
    if (w.records.some((x) => x.id === r.id)) return r;
    writeWorkspace({ ...w, records: [r, ...w.records] });
    return r;
  },
};

/* ---------- query keys + hooks ---------- */
export const getListRecordsQueryKey = () => ['local', 'records'] as const;
export const getGetSummaryQueryKey = () => ['local', 'summary'] as const;
export const getProfileQueryKey = () => ['local', 'profile'] as const;

export function useListRecords(_opts?: unknown) {
  return useQuery({ queryKey: getListRecordsQueryKey(), queryFn: () => store.list(), staleTime: Infinity, retry: false });
}

export function useProfile() {
  return useQuery({ queryKey: getProfileQueryKey(), queryFn: () => readWorkspace().profile, staleTime: Infinity, retry: false });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Profile) => { const w = readWorkspace(); writeWorkspace({ ...w, profile: { name: p.name?.trim() || undefined } }); return p; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local'] }),
  });
}

export type Summary = {
  total: number; active: number; interviews: number; offers: number; conversionRate: number;
  experienceCount: number; resumeCount: number; completedGoals: number; totalGoals: number;
  upcoming: CareerRecord[]; recent: CareerRecord[]; recommendations: string[];
};

export function computeSummary(all: CareerRecord[]): Summary {
  const opps = all.filter((r) => r.kind === 'opportunity');
  const st = (r: CareerRecord) => r.status ?? 'saved';
  const interviews = opps.filter((o) => st(o) === 'interview').length;
  const offers = opps.filter((o) => st(o) === 'offer').length;
  const submitted = opps.filter((o) => st(o) !== 'saved').length;
  const active = opps.filter((o) => !['offer', 'rejected', 'withdrawn'].includes(st(o))).length;
  const exp = all.filter((r) => r.kind === 'experience');
  const resumes = all.filter((r) => r.kind === 'resume');
  const goals = all.filter((r) => r.kind === 'goal');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = opps
    .filter((o) => !['rejected', 'withdrawn'].includes(st(o)))
    .map((o) => ({ o, when: o.interviewAt || o.deadline }))
    .filter((x) => x.when && new Date(x.when) >= today)
    .sort((a, b) => a.when!.localeCompare(b.when!))
    .slice(0, 6).map((x) => x.o);
  const recent = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const rec: string[] = [];
  if (!exp.length) rec.push('Add one vault entry with a measurable result. It powers resumes and coaching.');
  else if (exp.filter((e) => !e.results).length) rec.push(`${exp.filter((e) => !e.results).length} vault ${exp.filter((e) => !e.results).length === 1 ? 'entry has' : 'entries have'} no measurable result yet. Add a number.`);
  if (!opps.length) rec.push('Track a role you are considering in Opportunities.');
  const noJd = opps.filter((o) => !o.description && !['rejected', 'withdrawn'].includes(st(o))).length;
  if (noJd) rec.push(`Paste the job description into ${noJd} ${noJd === 1 ? 'opportunity' : 'opportunities'} so tailoring and coaching can use it.`);
  if (!resumes.length) rec.push('Start a plain-text resume from the template or import one.');
  if (interviews && !all.some((r) => r.kind === 'interview')) rec.push('You have an interview stage role. Generate practice questions in Coach.');
  if (!all.some((r) => r.kind === 'dna')) rec.push('Take the 12-prompt Career DNA reflection.');
  if (!goals.filter((g) => g.status !== 'completed').length) rec.push('Set one dated, measurable goal in Insights.');
  return {
    total: all.length, active, interviews, offers,
    conversionRate: submitted ? ((interviews + offers) / submitted) * 100 : 0,
    experienceCount: exp.length, resumeCount: resumes.length,
    completedGoals: goals.filter((g) => g.status === 'completed').length, totalGoals: goals.length,
    upcoming, recent, recommendations: rec.slice(0, 4),
  };
}

export function useGetSummary(_opts?: unknown) {
  const q = useListRecords();
  const data = q.data ? computeSummary(q.data) : undefined;
  return { ...q, data };
}

/* ---------- AI adapter: wraps the generated useAssistCareer hook ---------- */
const LIM: Partial<Record<keyof CareerEvidence, number>> = { title: 500, company: 500, category: 100, description: 20000, results: 10000, skills: 10000, content: 80000, notes: 10000, startDate: 50, endDate: 50 };
export function toEvidence(r: CareerRecord): CareerEvidence {
  const e: CareerEvidence = { id: r.id.slice(0, 100), kind: r.kind, title: (r.title || 'Untitled').slice(0, 500) };
  const src = r as unknown as Record<string, unknown>;
  for (const k of Object.keys(LIM) as (keyof CareerEvidence)[]) {
    if (k === 'title') continue;
    const v = src[k];
    if (typeof v === 'string' && v) (e as unknown as Record<string, string>)[k] = v.slice(0, LIM[k]);
  }
  return e;
}

export type CoachInput = {
  mode: CareerAssistInputMode;
  resumeId?: string; opportunityId?: string; jobDescription?: string;
  selectedExperienceIds?: string[]; question?: string; answer?: string; instructions?: string;
};

export function useRunCoach(options?: { mutation?: { onSuccess?: (r: CareerRecord) => void } }) {
  const assist = useAssistCareer();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: CoachInput }): Promise<CareerRecord> => {
      const all = store.list();
      const byId = new Map(all.map((r) => [r.id, r]));
      const chosen: CareerRecord[] = [];
      const resume = data.resumeId ? byId.get(data.resumeId) : undefined;
      if (data.resumeId && !resume) throw new Error('The source resume is no longer available.');
      if (resume) chosen.push(resume);
      const opp = data.opportunityId ? byId.get(data.opportunityId) : undefined;
      if (data.opportunityId && !opp) throw new Error('The chosen opportunity is no longer available.');
      if (opp) chosen.push(opp);
      let expIds: string[] | undefined;
      if (data.mode === 'insights') {
        const rest = [...all].filter((r) => r.kind !== 'insight').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50);
        chosen.push(...rest.filter((r) => !chosen.includes(r)));
      } else if (data.selectedExperienceIds !== undefined) {
        const missing = data.selectedExperienceIds.filter((id) => !byId.has(id));
        if (missing.length) throw new Error('A selected Vault source is no longer available. Clear the selection and choose again.');
        expIds = data.selectedExperienceIds.slice(0, 40);
        chosen.push(...expIds.map((id) => byId.get(id)!));
      } else {
        const recent = all.filter((r) => r.kind === 'experience').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40);
        expIds = recent.map((r) => r.id);
        chosen.push(...recent);
      }
      const instructions = [data.jobDescription ? `Job description:\n${data.jobDescription}` : '', data.instructions ?? ''].filter(Boolean).join('\n\n').slice(0, 10000) || undefined;
      const result = await assist.mutateAsync({
        data: {
          mode: data.mode,
          records: chosen.slice(0, 50).map(toEvidence),
          opportunityId: opp?.id,
          sourceResumeId: resume?.id,
          selectedExperienceIds: expIds,
          question: data.question?.slice(0, 10000),
          answer: data.answer?.slice(0, 20000),
          instructions,
        },
      });
      if (!result?.content?.trim()) throw new Error('The assistant returned an empty draft. Nothing was saved. Try again.');
      const srcNote = `VAULT MODEL CONTEXT — ${expIds ? `${expIds.length} Vault ${expIds.length === 1 ? 'record' : 'records'}` : 'All recent records'} were sent${resume ? ` with source resume "${resume.title}"` : ''}${opp ? ` for "${opp.title}${opp.company ? ` / ${opp.company}` : ''}"` : ''}. Generated ${new Date().toLocaleString()}.`;
      const kind: RecordInputKind = data.mode === 'resume' ? 'resume' : data.mode === 'insights' ? 'insight' : 'interview';
      return store.create({
        kind,
        title: (result.title || (kind === 'resume' ? 'Tailored resume' : 'Coach session')).slice(0, 200),
        content: result.content,
        company: opp?.company,
        opportunityId: opp?.id,
        notes: kind === 'resume' ? `${srcNote}\n\nReview every line before sending.` : srcNote,
        description: data.mode === 'feedback' ? data.question : undefined,
      });
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['local'] }); options?.mutation?.onSuccess?.(r); },
  });
}
