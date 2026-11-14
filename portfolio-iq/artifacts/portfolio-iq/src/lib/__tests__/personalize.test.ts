import { describe, expect, it } from "vitest";
import type { LearningTopic, Preferences } from "@workspace/api-client-react";
import {
  EMPTY_PREFS, QUESTIONS, assistantPrompts, dashboardPlan, getAnswer, glossaryFor,
  hasAnswers, labelFor, learnStyle, prefChips, rankLessons, setAnswer, shapeContent,
  thesisPrompts,
} from "../personalize";

const prefs = (patch: Partial<Preferences> = {}): Preferences => ({ ...structuredClone(EMPTY_PREFS), ...patch });

// Explicit source-derived expectations, not generated from QUESTIONS: changing
// an original value, label, order, or single/multi mode must break this contract.
const definitions = [
  ["experience", false, "How much have you invested before?", [
    ["new", "I am completely new"], ["basics", "I understand the basics"],
    ["regular", "I invest regularly"], ["experienced", "I am experienced"],
  ]],
  ["objectives", true, "What brings you here?", [
    ["understand", "Understand what I already own"], ["learn", "Learn how investing works"],
    ["wealth", "Build long-term wealth"], ["diversification", "Check my diversification"],
    ["decisions", "Track my investment decisions"], ["retirement", "Plan for retirement"],
    ["home-business", "Save for a home or business"], ["practice", "Practice investing ideas"],
  ]],
  ["brokerages", true, "Where do you invest today?", [
    ["Fidelity", "Fidelity"], ["Vanguard", "Vanguard"], ["Robinhood", "Robinhood"],
    ["Charles Schwab", "Charles Schwab"], ["Other", "Another institution"], ["None", "Not investing yet"],
  ]],
  ["accountTypes", true, "Which kinds of accounts do you have?", [
    ["Roth IRA", "Roth IRA"], ["Traditional IRA", "Traditional IRA"], ["Brokerage", "Individual brokerage"],
    ["401(k)", "401(k)"], ["Savings", "Savings account"], ["Not sure", "Not sure"],
  ]],
  ["goals", true, "What are you working toward?", [
    ["Retirement", "Retirement"], ["Homeownership", "Buying a home"], ["Business", "Starting a business"],
    ["Financial independence", "Financial independence"], ["Learning", "Mostly learning"],
  ]],
  ["horizon", false, "When might you need this money?", [
    ["under-3", "Less than 3 years"], ["3-5", "3 to 5 years"], ["5-10", "5 to 10 years"],
    ["over-10", "More than 10 years"], ["unsure", "I am not sure"],
  ]],
  ["learning", true, "How do you like to learn?", [
    ["simple", "Simple explanations"], ["detailed", "Detailed explanations"],
    ["interactive", "Interactive examples"], ["visual", "Visual diagrams"], ["quizzes", "Quizzes and practice"],
  ]],
] as const;

describe("original setup answer contract", () => {
  it("starts empty without requiring login or completed setup", () => {
    expect(EMPTY_PREFS).toEqual({
      status: "new", experience: null, objectives: [], brokerages: [], accountTypes: [], goals: [], horizon: null, learning: [],
    });
    expect(hasAnswers(null)).toBe(false);
    expect(hasAnswers(prefs())).toBe(false);
    expect(hasAnswers(prefs({ status: "completed" }))).toBe(false);
    expect(hasAnswers(prefs({ status: "skipped" }))).toBe(false);
    expect(QUESTIONS.map((q) => q.key)).toEqual(definitions.map(([key]) => key));
  });

  it.each(definitions)("preserves %s choices and answer round trips", (key, multi, title, options) => {
    const q = QUESTIONS.find((q) => q.key === key)!;
    expect({ key: q.key, multi: q.multi, title: q.title, options: q.options.map((o) => [o.value, o.label]) })
      .toEqual({ key, multi, title, options });
    expect(q.help.trim().length).toBeGreaterThan(0);
    expect(getAnswer(prefs(), key)).toEqual([]);
    for (const [value, label] of options) {
      const before = prefs({ status: "skipped" });
      const result = setAnswer(before, key, [value]);
      expect(result).toEqual({ ...before, [key]: multi ? [value] : value });
      expect(before).toEqual(prefs({ status: "skipped" }));
      expect(getAnswer(result, key)).toEqual([value]);
      expect(hasAnswers(result)).toBe(true);
      expect(labelFor(key, value)).toBe(label);
      expect(setAnswer(result, key, [])).toEqual(before);
    }
    expect(labelFor(key, null)).toBe("");
    expect(labelFor(key, "legacy-value")).toBe("legacy-value");
    if (multi) {
      const values = options.map(([value]) => value);
      expect(getAnswer(setAnswer(prefs(), key, values), key)).toEqual(values);
    }
  });

  it.each(["experience", "horizon"] as const)("uses only the first %s value and clears to null", (key) => {
    const values = key === "experience" ? ["regular", "new"] : ["over-10", "under-3"];
    const original = prefs({ objectives: ["learn"], goals: ["Learning"] });
    const answered = setAnswer(original, key, values);
    expect(answered[key]).toBe(values[0]);
    expect(setAnswer(answered, key, [])[key]).toBeNull();
    expect(setAnswer(answered, key, [])).toEqual(original);
  });

  it("keeps explanatory account hints and brokerage privacy language", () => {
    const accounts = QUESTIONS.find((q) => q.key === "accountTypes")!.options;
    expect(accounts.filter((o) => o.hint).map((o) => o.value)).toEqual(["Roth IRA", "Traditional IRA", "Brokerage", "401(k)", "Savings"]);
    expect(accounts.find((o) => o.value === "Savings")!.hint).toBe("Bank deposits, not invested in markets.");
    expect(QUESTIONS.find((q) => q.key === "brokerages")!.help).toContain("never connects to or reads your brokerage account");
  });

  it("shows limited framing chips, not None/Other brokerage chips", () => {
    expect(prefChips(null)).toEqual([]);
    expect(prefChips(prefs())).toEqual([]);
    expect(prefChips(prefs({
      experience: "basics", goals: ["Homeownership", "Business", "Learning"], horizon: "under-3",
      brokerages: ["None", "Other", "Fidelity", "Vanguard", "Robinhood"],
    }))).toEqual(["I understand the basics", "Buying a home", "Starting a business", "Horizon: less than 3 years", "Fidelity", "Vanguard"]);
  });
});

describe("dashboard priorities", () => {
  const cases: [Partial<Preferences>, readonly string[], string][] = [
    [{}, ["allocation", "insights", "thesis", "learn", "wealth"], "your holdings first"],
    [{ objectives: ["understand"] }, ["allocation", "insights", "thesis", "learn", "wealth"], "your holdings first"],
    [{ objectives: ["diversification"] }, ["insights", "allocation", "thesis", "learn", "wealth"], "diversification first"],
    [{ objectives: ["learn"] }, ["learn", "allocation", "insights", "thesis", "wealth"], "learning first"],
    [{ objectives: ["practice"] }, ["learn", "allocation", "insights", "thesis", "wealth"], "learning first"],
    [{ objectives: ["decisions"] }, ["thesis", "allocation", "insights", "learn", "wealth"], "decisions first"],
    ...(["wealth", "retirement", "home-business"] as const).map((objective): [Partial<Preferences>, string[], string] =>
      [{ objectives: [objective] }, ["wealth", "allocation", "insights", "thesis", "learn"], "long-term goals first"]),
    [{ experience: "new" }, ["allocation", "learn", "insights", "thesis", "wealth"], "your holdings first"],
    [{ experience: "basics" }, ["allocation", "learn", "insights", "thesis", "wealth"], "your holdings first"],
    [{ objectives: ["learn", "practice"] }, ["learn", "allocation", "insights", "thesis", "wealth"], "learning first"],
    [{ objectives: ["wealth", "retirement", "home-business"], goals: ["Learning"] },
      ["wealth", "allocation", "insights", "thesis", "learn"], "long-term goals first"],
    [{ goals: ["Retirement", "Business"] }, ["allocation", "insights", "thesis", "learn", "wealth"], "your holdings first"],
    [{ experience: "new", objectives: ["learn", "decisions", "diversification", "understand", "wealth"], goals: ["Retirement"] },
      ["allocation", "insights", "learn", "thesis", "wealth"], "your holdings first"],
  ];

  it.each(cases)("orders sections for %j", (patch, order, focus) => {
    const input = prefs(patch);
    const before = structuredClone(input);
    const plan = dashboardPlan(input);
    expect(plan.order).toEqual(order);
    expect(plan.focus).toBe(focus);
    expect(plan.actions.map((a) => a.id)).toEqual(order.slice(0, 3));
    expect(input).toEqual(before);
    for (const action of plan.actions) {
      expect(action.href).toBe(({ allocation: "/portfolio", insights: "/portfolio", learn: "/learn", thesis: "/thesis", wealth: "/wealth" })[action.id as typeof plan.order[number]]);
      expect(action.title).not.toBe("");
      expect(action.body).not.toBe("");
      expect(action.cta).not.toBe("");
    }
  });

  it("supports unavailable answers and beginner-specific action wording", () => {
    expect(dashboardPlan(null)).toEqual(dashboardPlan(prefs()));
    expect(dashboardPlan(prefs({ experience: "new", objectives: ["learn"] })).actions[0].title).toBe("Start with the first lesson");
    expect(dashboardPlan(prefs({ experience: "regular", objectives: ["learn"] })).actions[0].title).toBe("Pick up a lesson");
  });
});

describe("lesson relevance scores and reasons", () => {
  // Deliberately synthetic educational topics isolate title/track matching from
  // a changing catalog. rankLessons scores in input order; Learn sorts by score.
  const lesson = (patch: Partial<LearningTopic> = {}): LearningTopic => ({
    id: "example", title: "Neutral topic", track: "General", minutes: 5, level: "Beginner",
    description: "Educational summary", content: "Educational content", risk: "Educational only",
    evidence: "Example", question: "What did you learn?", options: ["A", "B"],
    sources: [], completed: false, bookmarked: false, ...patch,
  });

  it.each([
    ["understand", "ETF basics", "Matches: understand what i already own"],
    ["learn", "How markets work", "Matches: learn how investing works"],
    ["wealth", "Long-term growth", "Matches: build long-term wealth"],
    ["diversification", "Concentration risk", "Matches: check my diversification"],
    ["decisions", "Behavior and bias", "Matches: track my investment decisions"],
    ["retirement", "Tax treatment", "Matches: plan for retirement"],
    ["home-business", "Emergency cash", "Matches: save for a home or business"],
    ["practice", "Compounding", "Matches: practice investing ideas"],
  ] as const)("matches %s using title or track", (objective, text, reason) => {
    for (const patch of [{ title: text.toUpperCase() }, { track: text.toUpperCase() }]) {
      expect(rankLessons([lesson(patch)], prefs({ objectives: [objective] }))[0]).toMatchObject({ score: 3, reason });
    }
    expect(rankLessons([lesson()], prefs({ objectives: [objective] }))[0]).toMatchObject({ score: 0, reason: null });
  });

  it.each(["Roth IRA", "Traditional IRA", "401(k)"] as const)("explains retirement-account relevance for %s", (account) => {
    expect(rankLessons([lesson({ title: "Roth IRA retirement" })], prefs({ accountTypes: [account] }))[0])
      .toMatchObject({ score: 2, reason: "Relates to your account types" });
  });

  it.each(["Brokerage", "Savings", "Not sure"] as const)("%s does not boost retirement topics", (account) => {
    expect(rankLessons([lesson({ title: "Roth IRA retirement" })], prefs({ accountTypes: [account] }))[0])
      .toMatchObject({ score: 0, reason: null });
  });

  it.each(["new", "basics", "regular", "experienced", null] as const)("applies the four-minute boundary for %s", (experience) => {
    for (const minutes of [4, 5]) {
      const short = (experience === "new" || experience === "basics") && minutes === 4;
      expect(rankLessons([lesson({ minutes })], prefs({ experience }))[0])
        .toMatchObject({ score: short ? 1 : 0, reason: short ? "A short starting point" : null });
    }
  });

  it("adds independent boosts once and uses objective, account, then short-start reason precedence", () => {
    const topic = lesson({ title: "Roth IRA retirement basics", minutes: 4 });
    const input = prefs({ objectives: ["understand", "retirement"], accountTypes: ["Roth IRA", "401(k)"], experience: "new" });
    expect(rankLessons([topic], input)[0]).toMatchObject({ score: 9, reason: "Matches: understand what i already own" });
    expect(rankLessons([topic], { ...input, objectives: ["retirement", "understand"] })[0].reason).toBe("Matches: plan for retirement");
    expect(rankLessons([topic], { ...input, objectives: [] })[0]).toMatchObject({ score: 3, reason: "Relates to your account types" });
    expect(rankLessons([topic], { ...input, objectives: [], accountTypes: [] })[0]).toMatchObject({ score: 1, reason: "A short starting point" });
  });

  it("subtracts ten for completion and preserves input-order tie breaks without mutating lessons or preferences", () => {
    const lessons = [lesson({ id: "done", title: "ETF", completed: true }), lesson({ id: "first" }), lesson({ id: "second" })];
    const input = prefs({ objectives: ["understand"] });
    const before = structuredClone({ lessons, input });
    const ranked = rankLessons(lessons, input);
    expect(ranked.map((r) => r.score)).toEqual([-7, -0.01, -0.02]);
    expect(ranked[0].reason).toBe("Matches: understand what i already own");
    expect([...ranked].sort((a, b) => b.score - a.score).map((r) => r.lesson.id)).toEqual(["first", "second", "done"]);
    expect({ lessons, input }).toEqual(before);
    expect(rankLessons(lessons, null).map(({ score, reason }) => ({ score, reason })))
      .toEqual([{ score: -10, reason: null }, { score: -0.01, reason: null }, { score: -0.02, reason: null }]);
  });
});

describe("learning presentation", () => {
  it.each([
    [null, [], "standard", "Balanced detail"],
    ["basics", [], "standard", "Balanced detail"],
    ["regular", [], "standard", "Balanced detail"],
    ["new", [], "simple", "Plain-language summaries"],
    ["experienced", [], "detailed", "Full detail"],
    ["regular", ["simple"], "simple", "Plain-language summaries"],
    ["new", ["detailed"], "detailed", "Full detail"],
    ["experienced", ["simple"], "detailed", "Full detail"],
    ["regular", ["simple", "detailed"], "detailed", "Full detail"],
  ] as const)("chooses depth for %s with %j", (experience, learning, depth, label) => {
    expect(learnStyle(prefs({ experience, learning: [...learning] })))
      .toEqual({ depth, label, quizFirst: false, visual: false, interactive: false });
  });

  it("supports unanswered preferences and independent display flags", () => {
    expect(learnStyle(null)).toEqual(learnStyle(prefs()));
    for (const [option, flag, text] of [
      ["quizzes", "quizFirst", "questions up front"], ["visual", "visual", "visual key points"],
      ["interactive", "interactive", "try-it prompts"],
    ] as const) {
      expect(learnStyle(prefs({ learning: [option] }))).toEqual({
        depth: "standard", quizFirst: false, visual: false, interactive: false,
        [flag]: true, label: `Balanced detail, ${text}`,
      });
    }
    expect(learnStyle(prefs({ learning: ["interactive", "visual", "quizzes", "simple"] }))).toEqual({
      depth: "simple", quizFirst: true, visual: true, interactive: true,
      label: "Plain-language summaries, questions up front, visual key points, try-it prompts",
    });
  });

  it.each(["simple", "detailed", "standard"] as const)("shapes %s paragraphs without discarding text", (depth) => {
    const style = { ...learnStyle(null), depth };
    const content = "First paragraph.\nStill first.\n\nSecond paragraph.\n\n\nThird paragraph.\n\nFourth paragraph.";
    const paragraphs = ["First paragraph.\nStill first.", "Second paragraph.", "Third paragraph.", "Fourth paragraph."];
    expect(shapeContent(content, style)).toEqual(depth === "simple"
      ? { lead: paragraphs.slice(0, 2), more: paragraphs.slice(2) } : { lead: paragraphs, more: [] });
    expect(shapeContent("", style)).toEqual({ lead: [], more: [] });
    expect(shapeContent(" \n\n\t", style)).toEqual({ lead: [], more: [] });
    expect(shapeContent("One\n\nTwo", style)).toEqual({ lead: ["One", "Two"], more: [] });
  });
});

describe("educational thesis prompts", () => {
  const retirement = { title: "Why this belongs in my retirement money", reasoning: "How long until I expect to use this? What would make me change it before then?" };
  const soon = { title: "Is this right for money I need soon?", reasoning: "If this fell 20% the year I need the money, what would I do?" };
  const diversify = { title: "What this adds that I do not already own", reasoning: "Which of my other holdings already cover the same companies or sectors?" };
  const beginner = { title: "What I understand about this fund", reasoning: "In one sentence, what does it hold? What do I still not understand?" };
  const experienced = { title: "What would make me sell", reasoning: "Write the specific condition, not a feeling. When will I check it?" };
  const independence = { title: "How this supports independence", reasoning: "Does this produce income, growth, or stability for my plan?" };
  const fallback = [{ title: "Why I own this", reasoning: "What do I believe, and what would have to be true?" }];

  it.each([
    [{ goals: ["Retirement"] }, retirement], [{ objectives: ["retirement"] }, retirement],
    [{ goals: ["Homeownership"] }, soon], [{ goals: ["Business"] }, soon],
    [{ horizon: "under-3" }, soon], [{ horizon: "3-5" }, soon],
    [{ objectives: ["diversification"] }, diversify],
    [{ experience: "new" }, beginner], [{ experience: "basics" }, beginner],
    [{ experience: "regular" }, experienced], [{ experience: "experienced" }, experienced],
    [{ goals: ["Financial independence"] }, independence],
  ] satisfies [Partial<Preferences>, { title: string; reasoning: string }][])("frames %j as a reflection, not a recommendation", (patch, prompt) => {
    expect(thesisPrompts(prefs(patch))).toEqual([prompt]);
  });

  it("falls back for missing and nonmatching answers", () => {
    expect(thesisPrompts(null)).toEqual(fallback);
    expect(thesisPrompts(prefs())).toEqual(fallback);
    for (const horizon of ["5-10", "over-10", "unsure"] as const) {
      expect(thesisPrompts(prefs({ horizon, goals: ["Learning"], objectives: ["wealth"] }))).toEqual(fallback);
    }
  });

  it("deduplicates matching branches, uses fixed priority, and caps output at four", () => {
    expect(thesisPrompts(prefs({
      objectives: ["diversification", "retirement"], horizon: "under-3", experience: "new",
      goals: ["Financial independence", "Business", "Retirement", "Homeownership"],
    }))).toEqual([retirement, soon, diversify, beginner]);
    expect(thesisPrompts(prefs({ experience: "regular", goals: ["Financial independence"] }))).toEqual([experienced, independence]);
  });
});

describe("assistant prompt suggestions", () => {
  const base = {
    Portfolio: ["What is my largest concentration?", "Explain my cash position in plain words"],
    Learn: ["What is the difference between an ETF and a mutual fund?", "Why does diversification matter?"],
    Thesis: ["What risks am I possibly overlooking?", "How should I know when to revisit a thesis?"],
    Wealth: ["How sensitive is compounding to the rate?", "Why do early contributions matter so much?"],
  } as const;

  it.each(["Portfolio", "Learn", "Thesis", "Wealth"] as const)("%s works without setup and without calling AI", (mode) => {
    expect(assistantPrompts(mode, null)).toEqual(base[mode]);
    expect(assistantPrompts(mode, prefs())).toEqual(base[mode]);
    expect(assistantPrompts(mode, prefs({ brokerages: ["None", "Other"], horizon: "unsure" }))).toEqual(base[mode]);
  });

  it.each(["Fidelity", "Vanguard", "Robinhood", "Charles Schwab"] as const)("uses the first named brokerage %s", (brokerage) => {
    expect(assistantPrompts("Portfolio", prefs({ brokerages: ["None", "Other", brokerage, "Fidelity"] })))
      .toEqual([`What do the cash lines on my ${brokerage} statement mean?`, ...base.Portfolio]);
  });

  it("prepends Learn extras in order and caps the combined list at three", () => {
    expect(assistantPrompts("Learn", prefs({ experience: "new" })))
      .toEqual(["Explain index funds like I am starting from zero", ...base.Learn]);
    expect(assistantPrompts("Learn", prefs({ accountTypes: ["Roth IRA"] })))
      .toEqual(["How is a Roth IRA different from a brokerage account?", ...base.Learn]);
    expect(assistantPrompts("Learn", prefs({ experience: "new", accountTypes: ["Roth IRA"] })))
      .toEqual(["Explain index funds like I am starting from zero", "How is a Roth IRA different from a brokerage account?", base.Learn[0]]);
    expect(assistantPrompts("Learn", prefs({ experience: "basics", accountTypes: ["Traditional IRA", "401(k)"] }))).toEqual(base.Learn);
  });

  it.each([
    ["Retirement", "retirement"], ["Homeownership", "buying a home"], ["Business", "starting a business"],
    ["Financial independence", "financial independence"], ["Learning", "mostly learning"],
  ] as const)("frames Thesis using the first goal %s", (goal, label) => {
    expect(assistantPrompts("Thesis", prefs({ goals: [goal, "Retirement"] })))
      .toEqual([`How do I write a thesis tied to ${label}?`, ...base.Thesis]);
  });

  it.each([
    ["under-3", "less than 3 years"], ["3-5", "3 to 5 years"],
    ["5-10", "5 to 10 years"], ["over-10", "more than 10 years"],
  ] as const)("frames Wealth for %s", (horizon, label) => {
    expect(assistantPrompts("Wealth", prefs({ horizon })))
      .toEqual([`What changes when my horizon is ${label}?`, ...base.Wealth]);
  });

  it("does not leak unrelated setup framing between modes", () => {
    expect(assistantPrompts("Portfolio", prefs({ experience: "new", accountTypes: ["Roth IRA"], goals: ["Business"], horizon: "under-3" }))).toEqual(base.Portfolio);
    expect(assistantPrompts("Learn", prefs({ brokerages: ["Fidelity"], goals: ["Business"], horizon: "under-3" }))).toEqual(base.Learn);
    expect(assistantPrompts("Thesis", prefs({ experience: "new", accountTypes: ["Roth IRA"], brokerages: ["Fidelity"], horizon: "under-3" }))).toEqual(base.Thesis);
    expect(assistantPrompts("Wealth", prefs({ experience: "new", accountTypes: ["Roth IRA"], brokerages: ["Fidelity"], goals: ["Business"] }))).toEqual(base.Wealth);
  });
});

describe("educational brokerage glossary", () => {
  const genericTerms = ["Market value", "Unrealized gain"];
  const terms = (p: Preferences | null) => glossaryFor(p).map(({ brokerage, entries }) => ({
    brokerage, terms: entries.map((e) => e.term),
  }));

  it("uses generic terms for unavailable, empty, None, and Other selections", () => {
    for (const input of [null, prefs(), prefs({ brokerages: ["None"] }), prefs({ brokerages: ["Other"] })]) {
      expect(terms(input)).toEqual([{ brokerage: "Any platform", terms: genericTerms }]);
    }
  });

  it.each([
    ["Fidelity", ["SPAXX (core position)", "Cost basis", "Pending activity"]],
    ["Vanguard", ["Settlement fund (VMFXX)", "Admiral shares"]],
    ["Robinhood", ["Buying power", "Fractional shares"]],
    ["Charles Schwab", ["Cash and cash investments", "Day change"]],
  ] as const)("keeps %s terms matched to that platform", (brokerage, expected) => {
    const input = prefs({ brokerages: [brokerage] });
    expect(terms(input)).toEqual([{ brokerage, terms: expected }]);
    expect(glossaryFor(input)[0].entries.every((entry) => entry.meaning.trim().length > 0)).toBe(true);
  });

  it("preserves selection order, excludes None, and handles a legacy unknown platform", () => {
    const input = prefs({ brokerages: ["Robinhood", "None", "Other", "Fidelity"] });
    const before = structuredClone(input);
    expect(terms(input).map((g) => g.brokerage)).toEqual(["Robinhood", "Any platform", "Fidelity"]);
    expect(terms({ ...input, brokerages: ["Legacy institution"] as unknown as Preferences["brokerages"] }))
      .toEqual([{ brokerage: "Legacy institution", terms: genericTerms }]);
    expect(input).toEqual(before);
  });

  it("retains key educational limitations instead of stock picks or live-price claims", () => {
    expect(glossaryFor(prefs({ brokerages: ["Fidelity"] }))[0].entries[0].meaning).toContain("cash-like, not a stock pick");
    expect(glossaryFor(prefs({ brokerages: ["Charles Schwab"] }))[0].entries[1].meaning).toContain("does not track daily changes or live prices");
    expect(glossaryFor(null)[0].entries[1].meaning).toContain("Needs cost basis to compute");
  });
});
