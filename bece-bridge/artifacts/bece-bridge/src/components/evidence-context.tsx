import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListMaterials, getListMaterialsQueryKey, type ResourceInputSourceMode } from "@workspace/api-client-react";

function useEvidenceState(courseId: string, initialMaterialIds: string[] = [], initialMode?: ResourceInputSourceMode) {
  const { user, isAuthenticated } = useAuth();
  const mats = useListMaterials({ query: {
    queryKey: [...getListMaterialsQueryKey(), user?.id ?? "anon"], enabled: isAuthenticated,
    staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 15000,
  } });
  const courseMats = useMemo(() => isAuthenticated ? (mats.data ?? []).filter(m => m.courseId === courseId) : [], [mats.data, courseId, isAuthenticated]);
  const [mode, setMode] = useState<ResourceInputSourceMode>(initialMode ?? (initialMaterialIds.length ? "materials" : "library"));
  const [picked, setPicked] = useState<string[]>(initialMaterialIds);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    if (!mats.isSuccess) return;
    setPicked(p => {
      const valid = p.filter(id => courseMats.some(m => m.id === id));
      return valid.length === p.length ? p : valid;
    });
  }, [courseMats, mats.isSuccess]);
  const validIds = picked.filter(id => courseMats.some(m => m.id === id)).slice(0, 5);
  const ready = mode === "library" || (mats.isSuccess && !mats.isError && validIds.length > 0 && consent);
  return { courseId, mode, setMode, picked, setPicked, consent, setConsent, validIds, ready, mats, courseMats, isAuthenticated };
}
type EvidenceState = ReturnType<typeof useEvidenceState> & { setCourseId: (id: string) => void };
const Context = createContext<EvidenceState | null>(null);

export function EvidenceProvider({ courseId, setCourseId, initialMaterialIds, initialMode, children }: { courseId: string; setCourseId: (id: string) => void; initialMaterialIds?: string[]; initialMode?: ResourceInputSourceMode; children: ReactNode }) {
  const state = useEvidenceState(courseId, initialMaterialIds, initialMode);
  return <Context.Provider value={{ ...state, setCourseId }}>{children}</Context.Provider>;
}
export function useEvidence() {
  const value = useContext(Context);
  if (!value) throw new Error("Evidence provider is required");
  return value;
}
export function ActiveEvidence() {
  const e = useEvidence();
  return <aside className="mb-5 rounded-md border bg-card p-3 text-xs" data-testid="active-evidence" aria-live="polite">
    <p className="font-medium">Active evidence · ECE {e.courseId} · {e.mode === "materials" ? "Selected materials only" : e.mode === "combined" ? "Materials + labeled AI supplementation" : "Course library + general AI"}</p>
    {e.mode !== "library" ? <><ul className="mt-2 flex flex-wrap gap-3">{e.courseMats.filter(m => e.validIds.includes(m.id)).map(m =>
      <li key={m.id}><a href={`/materials/${m.id}`} target="_blank" rel="noreferrer" className="underline">{m.title} (opens new tab)</a></li>)}</ul>
      {!e.ready && <p className="mt-2 text-muted-foreground">Evidence not ready: select available materials and authorize processing. Deleted sources are removed; there is no automatic switch to general AI.</p>}
    </> : <p className="mt-1 text-muted-foreground">No private lectures used. Course metadata establishes scope, not instructional evidence.</p>}
    <p className="mt-1 text-muted-foreground">Selection and consent apply across explanation, visuals and practice in this workspace session.</p>
  </aside>;
}
