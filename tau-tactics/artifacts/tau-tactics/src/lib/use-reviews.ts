import { useCallback, useEffect, useState } from "react";
import { readReviews, REVIEW_EVENT, REVIEW_PREFIX, type ReviewItem } from "./reviews";

export function useReviews() {
  const load = useCallback((): { items: ReviewItem[]; error: string | null } => {
    try { return readReviews(window.localStorage); }
    catch { return { items: [], error: "Could not read reviews on this device. Check browser storage access, then retry." }; }
  }, []);
  const [state, setState] = useState(load);
  const reload = useCallback(() => setState(load()), [load]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(REVIEW_PREFIX)) reload();
    };
    window.addEventListener(REVIEW_EVENT, reload);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener(REVIEW_EVENT, reload);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);
  return { ...state, reload };
}
