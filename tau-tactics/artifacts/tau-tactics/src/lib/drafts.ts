import { useEffect, useState } from "react";
import { readLS, writeLS } from "./store";

// Only drafts get an in-memory fallback. Failed record writes must never look saved.
const memory = new Map<string, { value: unknown; persisted: boolean }>();
const event = "tau-draft";
export const reflectionKey = (id: string) => `tau.draft.reflection.${encodeURIComponent(id)}`;
export const promptKey = (id: string, mode: string) => `tau.draft.prompt.${encodeURIComponent(id)}.${mode}`;
export function clearSessionDrafts(id: string) {
  for (const key of [reflectionKey(id), promptKey(id, "quiz"), promptKey(id, "review")]) writeDraft(key, null);
}

export function readDraft<T>(key: string): T | null {
  if (memory.has(key)) return memory.get(key)!.value as T | null;
  return readLS<T | null>(key, null);
}
export function writeDraft<T>(key: string, value: T | null) {
  const result = writeLS(key, value);
  memory.set(key, { value, persisted: result.ok });
  window.dispatchEvent(new Event(event));
  return result;
}
export function useDraftProtection() {
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if ([...memory.values()].some(v => !v.persisted)) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, []);
}
export function useDraft<T>(key: string) {
  const [, render] = useState(0);
  useEffect(() => {
    const sync = () => render(v => v + 1);
    const external = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        // Never replace text that failed to persist in this tab.
        if (memory.get(key)?.persisted) memory.delete(key);
        sync();
      }
    };
    window.addEventListener(event, sync);
    window.addEventListener("storage", external);
    return () => {
      window.removeEventListener(event, sync);
      window.removeEventListener("storage", external);
    };
  }, [key]);
  return {
    value: readDraft<T>(key),
    persisted: memory.get(key)?.persisted !== false,
    set: (value: T | null) => writeDraft(key, value),
  };
}
