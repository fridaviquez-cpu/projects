import type { Intention, Plan } from "./store";

export type PlanContext = Pick<Plan, "name" | "method" | "notes" | "ai" | "breakStyle">;
export type PlanHandoff = PlanContext & Pick<Plan, "duration" | "breakMinutes" | "task">;
export function planContext(p: PlanHandoff) {
  return {
    task: (p.task?.trim() || p.name.trim()).slice(0, 120),
    subject: "",
    intention: "Study" as const,
    plan: { name: p.name, method: p.method, notes: p.notes, ai: p.ai, breakStyle: p.breakStyle },
  };
}

export type Phase = { kind: "focus" | "break"; minutes: number };
export type TimerState = {
  version?: 2;
  runId: string;
  duration: number;
  phases: Phase[];
  index: number;
  status: "idle" | "running" | "paused" | "ready" | "done";
  endAt: number | null;
  remainingMs: number;
  task: string;
  subject?: string;
  intention?: Intention;
  plan?: PlanContext;
};
export const breakFor = (d: number) => d >= 90 ? 15 : d >= 50 ? 10 : d <= 25 ? 5 : 7;
export const validLengths = (d: number, b: number) => Number.isInteger(d) && d >= 1 && d <= 180 && Number.isInteger(b) && b >= 1 && b <= 60;
export const buildPhases = (d: number, b = breakFor(d)): Phase[] => [
  { kind: "focus", minutes: d }, { kind: "break", minutes: b },
  { kind: "focus", minutes: d }, { kind: "break", minutes: b },
];
export function fresh(d = 30, task = "", b = breakFor(d), context: Pick<TimerState, "subject" | "intention" | "plan"> = {}): TimerState {
  return { version: 2, runId: crypto.randomUUID(), duration: d, phases: buildPhases(d, b), index: 0, status: "idle", endAt: null, remainingMs: d * 60000, task, subject: context.subject ?? "", intention: context.intention ?? "Study", plan: context.plan };
}
export function restore(raw: unknown): TimerState {
  const s = raw as TimerState | null;
  if (s?.plan !== undefined && (!s.plan || ["name", "method", "notes", "ai", "breakStyle"].some(key => typeof s.plan![key as keyof PlanContext] !== "string"))) throw new Error("Saved plan context is invalid.");
  if (!s || typeof s.runId !== "string" || typeof s.task !== "string" ||
      !Array.isArray(s.phases) || s.phases.length !== 4 ||
      !validLengths(s.duration, s.phases[1]?.minutes) ||
      s.phases.some((p, i) => !p || p.kind !== (i % 2 ? "break" : "focus") || p.minutes !== (i % 2 ? s.phases[1].minutes : s.duration)) ||
      !Number.isInteger(s.index) || s.index < 0 || s.index > 3 ||
      !["idle", "running", "paused", "ready", "done"].includes(s.status) ||
      !Number.isFinite(s.remainingMs) || s.remainingMs < 0 ||
      (s.status === "running" && (typeof s.endAt !== "number" || !Number.isFinite(s.endAt)))) throw new Error("Saved timer is invalid.");
  // Old later phases may have started automatically. Never award them on migration.
  if (s.version !== 2 && s.index >= 2 && s.status !== "done") {
    return { ...s, version: 2, index: 2, status: "ready", endAt: null, remainingMs: s.duration * 60000 };
  }
  return { ...s, version: 2 };
}
export type Completion = { index: number; completedAt: number };
export function settle(s: TimerState, now: number): { state: TimerState; completions: Completion[] } {
  let state = s;
  const completions: Completion[] = [];
  while (state.status === "running" && state.endAt !== null && now >= state.endAt) {
    const at = state.endAt;
    if (state.phases[state.index].kind === "focus") completions.push({ index: state.index, completedAt: at });
    const index = state.index + 1;
    if (index === state.phases.length) state = { ...state, status: "done", endAt: null, remainingMs: 0 };
    else {
      const ms = state.phases[index].minutes * 60000;
      const ready = state.phases[index].kind === "focus";
      state = { ...state, index, status: ready ? "ready" : "running", endAt: ready ? null : at + ms, remainingMs: ms };
    }
  }
  return { state, completions };
}
export function transition(s: TimerState, action: "tick" | "start" | "pause" | "skip", now: number) {
  const result = settle(s, now);
  let state = result.state;
  // Boundary wins over pause/skip: never accidentally skip the newly reached phase.
  if (state !== s && action !== "start") return result;
  if (action === "start" && state.status !== "running") {
    if (state.status === "done") state = fresh(state.duration, state.task, state.phases[1].minutes, state);
    state = { ...state, status: "running", endAt: now + state.remainingMs };
  } else if (action === "pause" && state.status === "running") {
    state = { ...state, status: "paused", remainingMs: Math.min(state.phases[state.index].minutes * 60000, Math.max(0, state.endAt! - now)), endAt: null };
  } else if (action === "skip" && state.status !== "done") {
    const index = state.index + 1;
    if (index >= state.phases.length) state = { ...state, status: "done", endAt: null, remainingMs: 0 };
    else {
      const ms = state.phases[index].minutes * 60000;
      const status = state.phases[index].kind === "focus" ? "ready" : state.status === "running" ? "running" : "idle";
      state = { ...state, index, status, remainingMs: ms, endAt: status === "running" ? now + ms : null };
    }
  }
  return { state, completions: result.completions };
}
export const needsReplacementConfirmation = (s: TimerState) => s.status !== "idle" && s.status !== "done" || s.index > 0 && s.status !== "done";
