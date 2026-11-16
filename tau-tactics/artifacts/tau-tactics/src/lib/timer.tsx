import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { INTENTIONS, KEYS, readLSStrict, writeLS, type Intention, type Session } from "./store";
import { breakFor, fresh, restore, transition, validLengths, needsReplacementConfirmation, type TimerState } from "./timer-core";
import { planContext, type PlanHandoff } from "./timer-core";
export { breakFor, buildPhases, type TimerState, type Phase } from "./timer-core";

type Ctx = {
  state: TimerState; remaining: number; readOnly: boolean;
  start: () => void; pause: () => void; reset: () => void; skip: () => void;
  setDuration: (d: number) => boolean;
  configure: (d: number, b: number) => boolean;
  applyPlan: (plan: PlanHandoff) => boolean;
  setTask: (t: string) => void;
  setContext: (subject: string, intention: Intention) => void;
};
const TimerCtx = createContext<Ctx | null>(null);
function load(fallback: TimerState) {
  return restore(readLSStrict(KEYS.timer, fallback));
}
function persist(key: string, value: unknown) {
  const result = writeLS(key, value);
  if (!result.ok) throw new Error(result.error);
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => fresh());
  const [now, setNow] = useState(Date.now());
  const [owner, setOwner] = useState(false);
  const [error, setError] = useState("");
  const stateRef = useRef(state);
  const owns = useRef(false);
  const failed = useRef(false);
  const display = (s: TimerState) => { stateRef.current = s; setState(s); };
  const fail = () => { failed.current = true; setError("Could not read or save this timer on this device. Timer controls are disabled to protect your history. Keep this tab open and check browser storage before reloading."); };
  const commit = (s: TimerState) => { persist(KEYS.timer, s); display(s); };
  const advance = (action: "tick" | "start" | "pause" | "skip") => {
    if (!owns.current || failed.current) return;
    try {
      const cur = stateRef.current;
      const result = transition(cur, action, Date.now());
      for (const completed of result.completions) {
        const list = readLSStrict<Session[]>(KEYS.sessions, []);
        const id = `${cur.runId}-${completed.index}`;
        if (!list.some(s => s.id === id)) persist(KEYS.sessions, [{
          id, task: cur.task.trim() || "Untitled focus block", subject: cur.subject,
          intention: cur.intention ?? "Study", minutes: cur.phases[completed.index].minutes,
          completedAt: completed.completedAt,
        }, ...list]);
      }
      // History first: if timer persistence fails, replay deduplicates by run/phase ID.
      if (result.state !== cur) commit(result.state);
    } catch { fail(); }
  };

  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    const controller = new AbortController();
    const sync = () => {
      if (owns.current) return;
      try { display(load(stateRef.current)); } catch { fail(); }
    };
    sync();
    // Hold one exclusive browser lock for the lifetime of the owning tab.
    // No heartbeat/lease expiry: a suspended tab can never wake as a second writer.
    if (!navigator.locks) setError("This browser cannot safely coordinate timers across tabs. Use a browser with Web Locks support to start a timer.");
    else void navigator.locks.request("tau-timer-owner-v2", { signal: controller.signal }, async () => {
      if (disposed) return;
      owns.current = true;
      setOwner(true);
      try { display(load(stateRef.current)); advance("tick"); } catch { fail(); }
      await new Promise<void>(resolve => { release = resolve; });
      owns.current = false;
    }).catch(() => { if (!disposed) fail(); });
    const storage = (e: StorageEvent) => { if (e.key === KEYS.timer || e.key === null) sync(); };
    window.addEventListener("storage", storage);
    const id = window.setInterval(() => { setNow(Date.now()); advance("tick"); }, 250);
    return () => { disposed = true; owns.current = false; controller.abort(); release?.(); clearInterval(id); window.removeEventListener("storage", storage); };
  }, []);

  const replace = (d: number, b: number, context?: ReturnType<typeof planContext>) => {
    if (!owns.current || failed.current || !validLengths(d, b)) return false;
    if (needsReplacementConfirmation(stateRef.current) && !confirm("Replace this active run? Unfinished focus time will not be logged. Completed blocks stay in history.")) return false;
    advance("tick");
    if (failed.current) return false;
    try { commit(fresh(d, context ? context.task : stateRef.current.task, b, context ?? stateRef.current)); return true; } catch { fail(); return false; }
  };
  const edit = (patch: Partial<TimerState>) => {
    if (!owns.current || failed.current || stateRef.current.status === "running") return;
    try { commit({ ...stateRef.current, ...patch }); } catch { fail(); }
  };
  const readOnly = !owner || !!error;
  const ph = state.phases[state.index];
  const feedback = error || (!owner ? "Timer is read-only here. Close the other TAU tab to control it here." :
    state.status === "ready" ? "Break finished. Start next block when you are ready, or stop here." :
    state.status === "done" ? "Run finished. Only completed focus blocks are in history." :
    `${ph.kind === "focus" ? `Focus ${Math.floor(state.index / 2) + 1}` : "Break"} ${state.status === "running" ? "started" : state.status === "paused" ? "paused" : "ready"} · ${ph.minutes} minutes.`);
  const value: Ctx = {
    state, readOnly, remaining: state.status === "running" && state.endAt !== null ? Math.min(ph.minutes * 60000, Math.max(0, state.endAt - now)) : state.remainingMs,
    start: () => advance("start"), pause: () => advance("pause"), skip: () => advance("skip"),
    reset: () => { replace(stateRef.current.duration, stateRef.current.phases[1].minutes); },
    setDuration: d => replace(d, breakFor(d)), configure: replace,
    applyPlan: p => replace(p.duration, p.breakMinutes ?? breakFor(p.duration), planContext(p)),
    setTask: task => edit({ task: task.slice(0, 120) }),
    setContext: (subject, intention) => { if (INTENTIONS.includes(intention)) edit({ subject: subject.slice(0, 80), intention }); },
  };
  return <TimerCtx.Provider value={value}>
    <p role="status" aria-live="polite" aria-atomic="true" className="border-b border-border bg-card px-4 py-2 text-sm md:ml-64" data-testid="timer-status">{feedback}</p>
    {children}
  </TimerCtx.Provider>;
}
export function useTimer() {
  const c = useContext(TimerCtx);
  if (!c) throw new Error("useTimer outside provider");
  return c;
}
