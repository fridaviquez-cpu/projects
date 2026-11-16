import { useCallback, useEffect, useState } from "react";
import { validateStored } from "./storage-validation";

const EVT = "tau-store";
export type StorageResult = { ok: true } | { ok: false; error: string };
export type StorageIssue = { key: string; error: string; raw?: string; recoverable?: unknown };
const issues = new Map<string, StorageIssue>();
const ISSUE_EVT = "tau-storage-issue";
function report(issue: StorageIssue) {
  if (JSON.stringify(issues.get(issue.key)) === JSON.stringify(issue)) return;
  issues.set(issue.key, issue);
  queueMicrotask(() => window.dispatchEvent(new Event(ISSUE_EVT)));
}
function clearIssue(key: string) {
  if (issues.delete(key)) queueMicrotask(() => window.dispatchEvent(new Event(ISSUE_EVT)));
}
export function useStorageIssues() {
  const [value, setValue] = useState(() => [...issues.values()]);
  useEffect(() => {
    const sync = () => setValue([...issues.values()]);
    window.addEventListener(ISSUE_EVT, sync);
    sync();
    return () => window.removeEventListener(ISSUE_EVT, sync);
  }, []);
  return value;
}

export function readLS<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const checked = validateStored(key, JSON.parse(raw));
    if (checked.invalid) report({ key, raw, recoverable: checked.value ?? fallback, error: "Some stored data could not be read safely. The original is untouched; valid records remain visible. Download the original before repairing." });
    return (checked.value ?? fallback) as T;
  } catch {
    report({ key, ...(raw !== null ? { raw, recoverable: fallback } : {}), error: raw !== null ? "Stored data is malformed. The original is untouched. Download it before repairing." : "Browser storage cannot be read. Saving is unavailable; keep a copy of your writing." });
    return fallback;
  }
}

/** Critical writers cannot build on a partial recovery view. */
export function readLSStrict<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const checked = validateStored(key, JSON.parse(raw));
    if (checked.invalid) throw new Error("Stored data needs repair.");
    return checked.value as T;
  } catch (error) {
    readLS(key, fallback); // expose the original and its repair path
    throw error;
  }
}

export function writeLS<T>(key: string, value: T): StorageResult {
  try {
    // Re-read immediately before writing: never overwrite a corrupt or unreadable original.
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const original = validateStored(key, JSON.parse(raw));
      if (original.invalid) throw new Error("Repair the stored data before saving changes.");
    }
    if (validateStored(key, value).invalid) throw new Error("This data could not be saved safely.");
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    const error = "Could not save on this device. Storage may be blocked, full, or need repair. Your saved records have not changed.";
    report({ ...issues.get(key), key, error });
    return { ok: false, error };
  }
  clearIssue(key);
  window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
  return { ok: true };
}

/** Explicit repair only: a durable quarantine copy must succeed before replacement. */
export function repairStorage(issue: StorageIssue): StorageResult {
  try {
    if (issue.raw === undefined || localStorage.getItem(issue.key) !== issue.raw) throw new Error();
    localStorage.setItem(`${issue.key}.quarantine.${crypto.randomUUID()}`, issue.raw);
    localStorage.setItem(issue.key, JSON.stringify(issue.recoverable));
    clearIssue(issue.key);
    window.dispatchEvent(new CustomEvent(EVT, { detail: issue.key }));
    return { ok: true };
  } catch {
    return { ok: false, error: "Repair could not finish. The original has not been replaced. Free storage or allow browser storage and try again." };
  }
}

export function useLocal<T>(key: string, fallback: T) {
  const [val, setVal] = useState<T>(() => readLS(key, fallback));
  useEffect(() => {
    const sync = (e: Event) => {
      const k = (e as CustomEvent).detail ?? (e as StorageEvent).key;
      if (k === key || k === null) setVal(readLS(key, fallback));
    };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readLS(key, fallback);
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      const result = writeLS(key, v);
      if (result.ok) setVal(v);
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [val, set] as const;
}

export const KEYS = {
  timer: "tau.timer.v1",
  sessions: "tau.sessions.v1",
  plans: "tau.plans.v1",
  favorites: "tau.favorites.v1",
  quiz: "tau.quiz.v1",
  checklist: "tau.checklist.v1",
};

export const INTENTIONS = ["Study", "Practice", "Read", "Build", "Write"] as const;
export type Intention = (typeof INTENTIONS)[number];
export type Session = {
  id: string;
  task: string;
  subject?: string;
  intention?: Intention;
  minutes: number;
  completedAt: number;
  reflection?: { recalled: boolean; practiced: boolean; takeaway: string; unclear?: string };
};
export type Plan = {
  id: string;
  name: string;
  task?: string;
  duration: number;
  breakMinutes?: number;
  ai: string;
  method: string;
  breakStyle: string;
  notes: string;
  createdAt: number;
};
export type QuizResult = { type: string; answers: number[]; takenAt: number };

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { return document.execCommand("copy"); }
    catch { return false; }
    finally { ta.remove(); }
  }
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
