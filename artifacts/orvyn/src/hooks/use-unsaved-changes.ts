import { useEffect, useRef } from 'react';

/**
 * Resume drafts are persisted locally on every keystroke, so a reload is safe.
 * This hook only keeps the discard callback current for callers that need it.
 */
export function useUnsavedChanges(dirty: boolean, onDiscard: () => void) {
  const ref = useRef(onDiscard);
  ref.current = onDiscard;
  useEffect(() => {
    document.documentElement.dataset.unsaved = dirty ? 'true' : 'false';
    return () => { delete document.documentElement.dataset.unsaved; };
  }, [dirty]);
}
