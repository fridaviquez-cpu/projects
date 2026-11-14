import { useQueryClient } from "@tanstack/react-query";
import { getGetPersonalizationQueryKey, getGetWorkspaceQueryKey, useGetPersonalization, useSavePersonalization, type Preferences } from "@workspace/api-client-react";

/** Saved setup answers for this private workspace. `prefs` is null until loaded (or on error), so callers fall back to defaults. */
export function usePrefs() {
  const query = useGetPersonalization();
  return { query, prefs: query.data ?? null };
}

/** Save answers; on success patches the personalization cache and refreshes the workspace (legacy experience sync). */
export function useSavePrefs() {
  const qc = useQueryClient();
  return useSavePersonalization({
    mutation: {
      onSuccess: (saved: Preferences) => {
        qc.setQueryData(getGetPersonalizationQueryKey(), saved);
        qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
      },
    },
  });
}

/** Compare answers only (status excluded). */
export const sameAnswers = (a: Preferences, b: Preferences) =>
  JSON.stringify({ ...a, status: "" }) === JSON.stringify({ ...b, status: "" });
