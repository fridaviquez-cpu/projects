import type { Session } from "@/lib/store";

export type Tier = { min: number; key: "fresh" | "momentum" | "strong" | "thriving"; label: string; line: string };

export const TIERS: Tier[] = [
  { min: 0, key: "fresh", label: "Starting fresh", line: "Every guardian starts somewhere. One finished block wakes him up." },
  { min: 4, key: "momentum", label: "Building momentum", line: "Mane's filling in. Recall and practice make him grow faster than hours do." },
  { min: 12, key: "strong", label: "Strong", line: "Steady, practiced, sharp. This is what effective studying looks like." },
  { min: 24, key: "thriving", label: "Thriving", line: "Full mane, laurel earned. Keep checking in to keep the habit honest." },
];

export type Breakdown = { sessions: number; recalled: number; practiced: number; takeaways: number; score: number };

/** Pure: 1 per completed session, +1 recalled, +1 practiced, +1 non-empty takeaway. */
export function scoreSessions(list: Session[]): Breakdown {
  const b: Breakdown = { sessions: 0, recalled: 0, practiced: 0, takeaways: 0, score: 0 };
  for (const s of list) {
    b.sessions += 1;
    const r = s.reflection;
    if (r?.recalled) b.recalled += 1;
    if (r?.practiced) b.practiced += 1;
    if (r?.takeaway && r.takeaway.trim()) b.takeaways += 1;
  }
  b.score = b.sessions + b.recalled + b.practiced + b.takeaways;
  return b;
}

export function tierFor(score: number) {
  let i = 0;
  TIERS.forEach((t, idx) => { if (score >= t.min) i = idx; });
  const next = TIERS[i + 1];
  return { tier: TIERS[i], index: i, next, toNext: next ? next.min - score : 0 };
}
