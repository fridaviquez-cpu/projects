import { describe, expect, it } from "vitest";
import type { Preferences } from "@workspace/api-client-react";
import { EMPTY_PREFS, QUESTIONS, wealthPrefill } from "../personalize";

describe("wealthPrefill", () => {
  it.each([
    ["under-3", 3, true],
    ["3-5", 5, true],
    ["5-10", 10, false],
    ["over-10", 25, false],
    ["unsure", null, false],
    [null, null, false],
  ] as const)("maps horizon %s to years %s and caveat %s", (horizon, years, shortHorizon) => {
    expect(wealthPrefill({ ...EMPTY_PREFS, horizon })).toEqual({
      years, goalLabel: null, shortHorizon,
    });
  });

  it("does not prefill while answers are unavailable", () => {
    expect(wealthPrefill(null)).toEqual({ years: null, goalLabel: null, shortHorizon: false });
  });

  const goals = QUESTIONS.find((q) => q.key === "goals")!.options;
  it.each(goals)("uses $value only as framing", ({ value, label }) => {
    const prefs: Preferences = { ...EMPTY_PREFS, horizon: "3-5", goals: [value as Preferences["goals"][number]] };
    const before = structuredClone(prefs);
    expect(wealthPrefill(prefs)).toEqual({ years: 5, goalLabel: label, shortHorizon: true });
    expect(prefs).toEqual(before);
  });

  it("frames around the first goal without deriving extra assumptions", () => {
    expect(wealthPrefill({ ...EMPTY_PREFS, goals: goals.map((g) => g.value as Preferences["goals"][number]) })).toEqual({
      years: null, goalLabel: "Retirement", shortHorizon: false,
    });
  });

  // Enumerate every unrelated setup answer, so new options join this safety check.
  const unrelated = QUESTIONS.filter((q) => q.key !== "goals" && q.key !== "horizon")
    .flatMap((q) => q.options.map((o) => ({ key: q.key, value: o.value, multi: q.multi })));
  it.each(unrelated)("$key=$value cannot add financial assumptions", ({ key, value, multi }) => {
    const prefs = { ...EMPTY_PREFS, [key]: multi ? [value] : value } as Preferences;
    expect(wealthPrefill(prefs)).toEqual(wealthPrefill(null));
  });

  it.each(["new", "completed", "skipped"] as const)("status %s does not change prefill", (status) => {
    expect(wealthPrefill({ ...EMPTY_PREFS, status, horizon: "5-10" })).toEqual({
      years: 10, goalLabel: null, shortHorizon: false,
    });
  });
});
