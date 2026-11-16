import type { Session } from "./store";

/** Calendar week in the student's local timezone, Monday through Sunday. */
export function focusHistory(sessions: Session[], now = new Date()) {
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const completed = sessions.filter(s => s.completedAt <= now.getTime());
  const week = completed.filter(s => s.completedAt >= weekStart.getTime());
  const counts = new Map<string, { subject: string; count: number }>();
  for (const s of completed) {
    const subject = s.subject?.trim().replace(/\s+/g, " ");
    if (!subject) continue;
    const key = subject.toLocaleLowerCase();
    const prev = counts.get(key);
    counts.set(key, { subject: prev?.subject ?? subject, count: (prev?.count ?? 0) + 1 });
  }
  return {
    weekStart,
    weekSessions: week.length,
    weekMinutes: week.reduce((sum, s) => sum + s.minutes, 0),
    totalMinutes: completed.reduce((sum, s) => sum + s.minutes, 0),
    subjects: [...counts.values()].sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject)).slice(0, 3),
  };
}

/** A local prompt builder, not an AI response. No session data is transmitted. */
export function sessionPrompt(s: Session, mode: "quiz" | "review") {
  const context = [
    `Subject: ${s.subject?.trim() || "Not specified"}`,
    `Session intention: ${s.intention ?? "Study"}`,
    `What I worked on: ${s.task}`,
    `What I understand better: ${s.reflection?.takeaway?.trim() || "Not recorded — ask me first."}`,
    `What still feels unclear: ${s.reflection?.unclear?.trim() || "Not recorded — ask me first."}`,
  ].join("\n");
  const instruction = mode === "quiz"
    ? "Quiz me on what I just studied. Ask one question at a time and wait for my answer. Begin with recall, then move to application. Do not show answers in advance. Give a hint before a solution, explain gaps in my reasoning, and finish with one targeted practice suggestion."
    : "Help me review this session. Ask me to explain the main idea in my own words first, then address what still feels unclear. Offer a short explanation and one worked example if useful, then ask me to apply it independently. Finish with one specific topic to revisit next time.";
  return `${instruction}\n\n${context}\n\nAsk for relevant notes or source material if needed; do not assume you have access to my course materials. Flag uncertainty. Help me learn rather than complete graded work for me.`;
}
