import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListCourses, getListCoursesQueryKey, type Course } from "@workspace/api-client-react";
import { btnAccent } from "@/components/kit";

/** Eligibility is resolved from the live catalog, not a baked-in ID list. */
export type CourseId = string;
export const isCourseId = (v: string | null | undefined): v is CourseId => !!v && /^\d{3}$/.test(v);

export type PilotOption = { id: CourseId; label: string; course: Course };

/** Live catalog membership is authoritative; no generated enum limits pilots. */
export function usePilotCourses() {
  const q = useListCourses({ query: { queryKey: getListCoursesQueryKey(), enabled: true } });
  const options = useMemo<PilotOption[]>(() => (q.data ?? [])
    .filter((c) => c.isPilot)
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((c) => ({ id: c.id as CourseId, label: `${c.code} · ${c.title}`, course: c })), [q.data]);
  return { options, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function errMsg(e: unknown, fallback = "Something went wrong.") {
  if (e && typeof e === "object") {
    const d = (e as { data?: unknown }).data;
    if (d && typeof d === "object") {
      const m = (d as { error?: unknown; message?: unknown }).error ?? (d as { message?: unknown }).message;
      if (typeof m === "string" && m) return m;
    }
    const s = (e as { status?: number }).status;
    if (s === 401) return "Please log in to use private materials.";
    if (s === 404) return "Not found, or it belongs to another account.";
    if (s === 413) return "That file is larger than 5 MB.";
  }
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Clears cached private data whenever the signed-in account changes. */
export function AuthCacheGuard() {
  const qc = useQueryClient();
  const { user, isLoading } = useAuth();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isLoading) return;
    const id = user?.id ?? null;
    if (prev.current !== undefined && prev.current !== id) {
      qc.cancelQueries();
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "/api/courses" });
      qc.invalidateQueries();
    }
    prev.current = id;
  }, [user?.id, isLoading, qc]);
  return null;
}

export function useSafeLogout() {
  const qc = useQueryClient();
  const { logout } = useAuth();
  return () => { qc.cancelQueries(); qc.clear(); logout(); };
}

export function LoginGate({ children }: { children?: React.ReactNode }) {
  const { login } = useAuth();
  return (
    <div className="rounded-lg border border-dashed grid-paper p-8 text-center" data-testid="gate-login">
      <p className="font-display text-xl font-semibold">Log in to use your lecture materials</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{children ?? "Uploads are private to your account. Guests can still explore courses and generate from the library."}</p>
      <button onClick={login} className={`${btnAccent} mt-5`} data-testid="button-login"><LogIn className="h-4 w-4" /> Log in</button>
    </div>
  );
}
