// Tab-local drafts survive route changes/reload, without changing a saved review.
export type ReviewDraft = {
  revision: string;
  editing: boolean;
  topic: string;
  date: string;
  attempt: string;
  prompt: string;
  next?: "revisit" | "example" | "pause";
  nextDate: string;
};
const cache = new Map<string, ReviewDraft>();
const key = (id: string) => `tau.review-draft.v1:${encodeURIComponent(id)}`;

export function readReviewDraft(id: string): ReviewDraft | null {
  if (cache.has(id)) return cache.get(id)!;
  try {
    const d = JSON.parse(sessionStorage.getItem(key(id)) ?? "null");
    if (d && typeof d.revision === "string" && typeof d.editing === "boolean" &&
      ["topic", "date", "attempt", "prompt", "nextDate"].every(k => typeof d[k] === "string") &&
      (d.next === undefined || ["revisit", "example", "pause"].includes(d.next))) {
      cache.set(id, d);
      return d;
    }
  } catch { /* A blocked draft read must not prevent access to the saved item. */ }
  return null;
}

export function writeReviewDraft(id: string, draft: ReviewDraft | null): boolean {
  if (draft) cache.set(id, draft); else cache.delete(id);
  try {
    if (draft) sessionStorage.setItem(key(id), JSON.stringify(draft));
    else sessionStorage.removeItem(key(id));
    return true;
  } catch { return false; }
}
