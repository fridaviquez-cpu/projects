import { z } from "zod";
import { restore } from "./timer-core";

const date = z.number().finite().min(0).max(8640000000000000);
const intention = z.enum(["Study", "Practice", "Read", "Build", "Write"]);
export const reflectionSchema = z.object({
  recalled: z.boolean(), practiced: z.boolean(), takeaway: z.string(), unclear: z.string().optional(),
}).passthrough();
const session = z.object({
  id: z.string().min(1), task: z.string(), minutes: z.number().finite().positive(),
  completedAt: date, subject: z.string().optional(), intention: intention.optional(),
  reflection: reflectionSchema.optional(),
}).passthrough();
const plan = z.object({
  id: z.string(), name: z.string(), duration: z.number().finite().positive(),
  ai: z.string(), method: z.string(), breakStyle: z.string(), notes: z.string(), createdAt: date,
}).passthrough();
const timer = z.object({
  runId: z.string(), duration: z.number().finite().positive(),
  phases: z.array(z.object({ kind: z.enum(["focus", "break"]), minutes: z.number().finite().positive() }).passthrough()).min(2),
  index: z.number().int().nonnegative(), status: z.enum(["idle", "running", "paused", "ready", "done"]),
  endAt: date.nullable(), remainingMs: z.number().finite().nonnegative(),
  task: z.string(), subject: z.string().optional(), intention: intention.optional(),
}).passthrough().refine(t => {
  try { restore(t); return true; } catch { return false; }
});

/** Keep unknown fields for forward compatibility. Never rewrite data on read. */
export function validateStored(key: string, value: unknown): { value: unknown; invalid: boolean } {
  let schema: z.ZodTypeAny | undefined;
  if (key === "tau.sessions.v1" || key === "tau.plans.v1") {
    if (!Array.isArray(value)) return { value: [], invalid: true };
    const item = key === "tau.sessions.v1" ? session : plan;
    const seen = new Set<string>();
    const valid = value.flatMap(v => {
      const parsed = item.safeParse(v);
      if (!parsed.success || seen.has(parsed.data.id)) return [];
      seen.add(parsed.data.id);
      return [parsed.data];
    });
    return { value: valid, invalid: valid.length !== value.length };
  }
  if (key === "tau.timer.v1") schema = timer;
  else if (key === "tau.quiz.v1") schema = z.object({ type: z.string(), answers: z.array(z.number().int().min(0).max(3)), takenAt: date }).nullable();
  else if (["tau.favorites.v1", "tau.checklist.v1", "tau.aichecks.v1", "tau.focus.dismissed.v1"].includes(key)) schema = z.array(z.string());
  else if (key.startsWith("tau.draft.reflection.")) schema = reflectionSchema.nullable();
  else if (key.startsWith("tau.draft.prompt.")) schema = z.string().nullable();
  else if (key === "tau.focus.active.v1") schema = z.string().nullable();
  if (!schema) return { value, invalid: false };
  const result = schema.safeParse(value);
  return { value: result.success ? result.data : undefined, invalid: !result.success };
}
