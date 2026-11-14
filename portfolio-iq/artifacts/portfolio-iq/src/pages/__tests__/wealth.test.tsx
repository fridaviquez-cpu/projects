import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGetPersonalizationQueryKey, type Preferences } from "@workspace/api-client-react";
import { EMPTY_PREFS, QUESTIONS } from "@/lib/personalize";
import Wealth from "../wealth";

// Only the HTTP boundary is replaced. Wealth, usePrefs, the generated query,
// React Query, number inputs, sliders, formatting, and calculation all run as shipped.
// jsdom has no layout engine; the observer shim is only for Radix thumb sizing.
const fetchMock = vi.fn<typeof fetch>();
let client: QueryClient;
const defaults = { start: 1000, monthly: 150, rate: 5, years: 25 };
type Inputs = typeof defaults;
const queryKey = getGetPersonalizationQueryKey();
const response = (prefs: Preferences) => Response.json(prefs);
const answers = (patch: Partial<Preferences> = {}): Preferences => ({ ...EMPTY_PREFS, ...patch });

function delayAnswers() {
  let resolve!: (prefs: Preferences) => void;
  const pending = new Promise<Preferences>((done) => { resolve = done; });
  // StrictMode can cancel/restart a request. Each fetch needs its own body,
  // just like separate HTTP responses; Response streams are single-use.
  fetchMock.mockImplementation(async () => response(await pending));
  return resolve;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  focusManager.setFocused(true);
});

afterEach(() => {
  cleanup();
  client.clear();
  focusManager.setFocused(undefined);
  vi.unstubAllGlobals();
});

function mount() {
  return render(
    <StrictMode>
      <QueryClientProvider client={client}><Wealth /></QueryClientProvider>
    </StrictMode>,
  );
}

async function load(prefs: Preferences) {
  fetchMock.mockImplementation(async () => response(prefs));
  const view = mount();
  await waitFor(() => expect(client.getQueryData(queryKey)).toEqual(prefs));
  await waitFor(() => expect(client.isFetching()).toBe(0));
  return view;
}

function input(key: keyof Inputs) {
  return screen.getByTestId<HTMLInputElement>(`input-${key}`);
}

function edit(key: keyof Inputs, value: number) {
  fireEvent.change(input(key), { target: { value: String(value) } });
}

function expectInputs(expected: Inputs) {
  const sliders = screen.getAllByRole("slider");
  for (const [index, key] of (Object.keys(expected) as (keyof Inputs)[]).entries()) {
    expect(input(key).value, key).toBe(String(expected[key]));
    expect(sliders[index].getAttribute("aria-valuenow"), `${key} slider`).toBe(String(expected[key]));
  }
  expect(document.getElementById("years-v")!.textContent).toBe(`${expected.years} years`);
}

// Independent closed-form annuity oracle: end-of-month additions, monthly
// compounding, no fees/tax/inflation, starting dollars converted to cents.
// Do not import the page's loop: a changed formula must fail these assertions.
function expectProjection({ start, monthly, rate, years }: Inputs) {
  const r = rate / 1200;
  const atYear = (year: number) => {
    const factor = (1 + r) ** (12 * year);
    return Math.round(start * 100 * factor + monthly * 100 * (r === 0 ? 12 * year : (factor - 1) / r));
  };
  const balance = atYear(years);
  const contributed = start * 100 + monthly * 100 * 12 * years;
  const format = (cents: number) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(cents / 100);
  expect(screen.getByTestId("text-final-balance").textContent).toBe(format(balance));
  const summary = screen.getByTestId("text-final-balance").parentElement!.parentElement!;
  expect([...summary.querySelectorAll(".num")].map((n) => n.textContent)).toEqual([
    format(balance), format(contributed), format(balance - contributed),
  ]);
  const chart = screen.getByRole("img", {
    name: `Illustration: ${format(balance)} after ${years} years at a constant ${rate}%`,
  });
  const paths = chart.querySelectorAll("path");
  for (const path of paths) {
    expect(path.getAttribute("d")).not.toMatch(/NaN|Infinity/);
  }
  expect(paths[0].getAttribute("d")).toBe(`${paths[1].getAttribute("d")} L600,240 L0,240 Z`);
  // Assert each plotted year, not just a rounded final dollar amount.
  for (const [index, contributionOnly] of [[1, false], [2, true]] as const) {
    const points = [...paths[index].getAttribute("d")!.matchAll(/[ML]([\d.e+-]+),([\d.e+-]+)/g)];
    expect(points).toHaveLength(years + 1);
    points.forEach((point, year) => {
      const value = contributionOnly ? start * 100 + monthly * 100 * 12 * year : atYear(year);
      expect(Number(point[1])).toBeCloseTo(year / years * 600, 7);
      expect(Number(point[2])).toBeCloseTo(240 - value / Math.max(1, balance) * 240, 7);
    });
  }
}

async function refetch(prefs: Preferences, focus = false) {
  const callsBefore = fetchMock.mock.calls.length;
  fetchMock.mockImplementation(async () => response(prefs));
  await act(async () => {
    if (focus) {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    } else {
      await client.invalidateQueries({ queryKey });
    }
  });
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  await waitFor(() => expect(client.getQueryData(queryKey)).toEqual(prefs));
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

function failAnswers() {
  // Return a fresh HTTP response for every request, including StrictMode restarts.
  fetchMock.mockImplementation(async () => Response.json(
    { message: "Saved answers are temporarily unavailable" },
    { status: 503 },
  ));
}

async function expectPersonalizationError() {
  await waitFor(() => expect(client.getQueryState(queryKey)?.status).toBe("error"));
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

describe("Wealth numeric boundaries", () => {
  it.each([
    [2.1, 2], [2.5, 3], [2.9, 3], [1.49, 1], [49.5, 50],
  ])("rounds %s years to %s across controls, totals, and chart", async (typed, years) => {
    await load(answers());
    edit("years", typed);
    expectInputs({ ...defaults, years });
    expectProjection({ ...defaults, years });
    // Keyboard adjustments continue from the normalized value, not the fraction.
    const key = years === 50 ? "ArrowLeft" : "ArrowRight";
    const next = years + (years === 50 ? -1 : 1);
    fireEvent.keyDown(screen.getAllByRole("slider")[3], { key });
    expectInputs({ ...defaults, years: next });
    expectProjection({ ...defaults, years: next });
  });

  it.each([
    { start: 1000, monthly: 150, rate: 0, years: 25 },
    { start: 0, monthly: 150, rate: 0, years: 25 },
    { start: 1000, monthly: 0, rate: 0, years: 25 },
    { start: 0, monthly: 0, rate: 0, years: 25 },
    { start: 0, monthly: 150, rate: 5, years: 25 },
    { start: 1000, monthly: 0, rate: 5, years: 25 },
    { start: 0, monthly: 0, rate: 5, years: 25 },
  ])("keeps zero-value projections consistent for $start/$monthly/$rate", async (expected) => {
    await load(answers());
    for (const key of Object.keys(expected) as (keyof Inputs)[]) edit(key, expected[key]);
    expectInputs(expected);
    expectProjection(expected);
  });

  it.each([
    ["start", -1, 0], ["start", 500001, 500000],
    ["monthly", -1, 0], ["monthly", 10001, 10000],
    ["rate", -0.5, 0], ["rate", 12.5, 12],
    ["years", 0, 1], ["years", 51, 50],
    ["years", 0.5, 1], ["years", 50.5, 50],
  ] as const)("clamps %s=%s to %s without mismatching the illustration", async (key, typed, clamped) => {
    await load(answers());
    edit(key, typed);
    const expected = { ...defaults, [key]: clamped };
    expectInputs(expected);
    expectProjection(expected);
  });

  it.each([
    { start: 0, monthly: 0, rate: 0, years: 1 },
    { start: 500000, monthly: 10000, rate: 12, years: 50 },
  ])("accepts all exact limits together: $start/$monthly/$rate/$years", async (expected) => {
    await load(answers());
    for (const key of Object.keys(expected) as (keyof Inputs)[]) edit(key, expected[key]);
    expectInputs(expected);
    expectProjection(expected);
  });
});

describe("Wealth personalization integration", () => {
  it("shows the unpersonalized arithmetic defaults while preferences load", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    mount();
    expectInputs(defaults);
    expectProjection(defaults);
    expect(screen.queryByTestId("panel-wealth-context")).toBeNull();
  });

  it("keeps defaults usable after an HTTP error and prefills only after an untouched recovery", async () => {
    failAnswers();
    mount();
    await expectPersonalizationError();
    expect(client.getQueryData(queryKey)).toBeUndefined();
    expectInputs(defaults);
    expectProjection(defaults);
    expect(screen.queryByTestId("panel-wealth-context")).toBeNull();
    expect(screen.queryByTestId("text-short-horizon-caveat")).toBeNull();
    expect(screen.queryByText(/Years start at/)).toBeNull();

    await refetch(answers({ horizon: "3-5", goals: ["Homeownership"] }));
    await waitFor(() => expect(input("years").value).toBe("5"));
    expect(client.getQueryState(queryKey)?.status).toBe("success");
    expectInputs({ ...defaults, years: 5 });
    expectProjection({ ...defaults, years: 5 });
    expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 5 from your time horizon answer");
    expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Buying a home");
    expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull();
  });

  it.each([
    ["years", 7], ["start", 2400], ["monthly", 230], ["rate", 8],
  ] as const)("preserves a manual %s edit after an HTTP error and later successful responses", async (key, value) => {
    failAnswers();
    mount();
    await expectPersonalizationError();
    edit(key, value);
    const expected = { ...defaults, [key]: value };
    expectInputs(expected);
    expectProjection(expected);
    expect(screen.queryByTestId("panel-wealth-context")).toBeNull();

    await refetch(answers({ horizon: "under-3", goals: ["Homeownership"] }), true);
    expect(client.getQueryState(queryKey)?.status).toBe("success");
    expectInputs(expected);
    expectProjection(expected);
    expect(screen.queryByText(/Years start at/)).toBeNull();
    expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull();
    expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Buying a home");

    await refetch(answers({ horizon: "over-10", goals: ["Retirement"] }));
    expectInputs(expected);
    expectProjection(expected);
    expect(screen.queryByText(/Years start at/)).toBeNull();
    expect(screen.queryByTestId("text-short-horizon-caveat")).toBeNull();
    expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Retirement");
  });

  it("retains successfully loaded context through a failed refetch and updates it on recovery", async () => {
    const saved = answers({ horizon: "under-3", goals: ["Homeownership"] });
    await load(saved);
    failAnswers();
    await act(async () => { await client.invalidateQueries({ queryKey }); });
    await expectPersonalizationError();
    expect(client.getQueryData(queryKey)).toEqual(saved);
    expectInputs({ ...defaults, years: 3 });
    expectProjection({ ...defaults, years: 3 });
    expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull();
    expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Buying a home");
    expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 3 from your time horizon answer");

    // The failed background request must not disable manual controls.
    fireEvent.keyDown(screen.getAllByRole("slider")[3], { key: "ArrowRight" });
    const expected = { ...defaults, years: 4 };
    expectInputs(expected);
    expectProjection(expected);
    expect(screen.queryByText(/Years start at/)).toBeNull();

    await refetch(answers({ horizon: "over-10", goals: ["Retirement"] }), true);
    expect(client.getQueryState(queryKey)?.status).toBe("success");
    expectInputs(expected);
    expectProjection(expected);
    expect(screen.queryByText(/Years start at/)).toBeNull();
    expect(screen.queryByTestId("text-short-horizon-caveat")).toBeNull();
    expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Retirement");
  });

  const horizons = [
    ["under-3", 3, true], ["3-5", 5, true], ["5-10", 10, false],
    ["over-10", 25, false], ["unsure", 25, false], [null, 25, false],
  ] as const;
  const goals = [null, ...QUESTIONS.find((q) => q.key === "goals")!.options.map((g) => g.value as Preferences["goals"][number])];
  const cases = horizons.flatMap(([horizon, years, caveat]) =>
    goals.map((goal) => ({ horizon, years, caveat, goal })));

  it.each(cases)("$horizon with goal $goal changes only years/framing", async ({ horizon, years, caveat, goal }) => {
    await load(answers({ horizon, goals: goal ? [goal] : [] }));
    expectInputs({ ...defaults, years });
    expectProjection({ ...defaults, years });
    expect(!!screen.queryByTestId("text-short-horizon-caveat")).toBe(caveat);
    const hasPrefill = horizon !== null && horizon !== "unsure";
    expect(!!screen.queryByText(/Years start at/)).toBe(hasPrefill);
    if (goal) {
      const label = QUESTIONS.find((q) => q.key === "goals")!.options.find((g) => g.value === goal)!.label;
      expect(screen.getByTestId("panel-wealth-context").textContent).toContain(`Framed around your goal: ${label}`);
    }
  });

  const unrelated = QUESTIONS.filter((q) => q.key !== "horizon" && q.key !== "goals")
    .flatMap((q) => q.options.map((o) => ({ key: q.key, value: o.value, multi: q.multi })));
  it.each(unrelated)("$key=$value cannot change any input or the formula", async ({ key, value, multi }) => {
    await load(answers({ [key]: multi ? [value] : value }));
    expectInputs(defaults);
    expectProjection(defaults);
    expect(screen.queryByTestId("panel-wealth-context")).toBeNull();
  });

  it.each([
    ["years", 7], ["start", 2400], ["monthly", 230], ["rate", 8],
  ] as const)("a late response cannot replace a manual %s edit or prefill years", async (key, value) => {
    const resolve = delayAnswers();
    mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    edit(key, value);
    const expected = { ...defaults, [key]: value };
    expectInputs(expected);
    await act(async () => { resolve(answers({ horizon: "under-3", goals: ["Homeownership"] })); });
    await waitFor(() => expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull());
    expectInputs(expected);
    expectProjection(expected);
    expect(screen.queryByText(/Years start at/)).toBeNull();
  });

  it.each(horizons)("keeps the applied prefill explanation when untouched answers refetch to %s", async (horizon, _years, caveat) => {
    await load(answers({ horizon: "under-3" }));
    expectInputs({ ...defaults, years: 3 });
    expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 3 from your time horizon answer; change them freely.");
    for (const focus of [false, true]) {
      await refetch(answers({ horizon, goals: ["Retirement"] }), focus);
      expectInputs({ ...defaults, years: 3 });
      expectProjection({ ...defaults, years: 3 });
      expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 3 from your time horizon answer; change them freely.");
      expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Retirement");
      expect(!!screen.queryByTestId("text-short-horizon-caveat")).toBe(caveat);
    }
  });

  it.each(horizons)("uses updated cached horizon %s on a new visit with the same QueryClient", async (horizon, years, caveat) => {
    const firstVisit = await load(answers({ horizon: "under-3", goals: ["Homeownership"] }));
    expectInputs({ ...defaults, years: 3 });
    expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 3 from your time horizon answer; change them freely.");
    expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull();
    // Both the one-time prefill guard and manual-edit guard belong to this visit.
    edit("years", 7);
    expect(screen.queryByText(/Years start at/)).toBeNull();
    firstVisit.unmount();
    expect(screen.queryByTestId("input-years")).toBeNull();

    const saved = answers({ horizon, goals: ["Retirement"] });
    client.setQueryData(queryKey, saved);
    fetchMock.mockImplementation(async () => response(saved));
    const callsBefore = fetchMock.mock.calls.length;
    mount();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expectInputs({ ...defaults, years });
    expectProjection({ ...defaults, years });
    expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Retirement");
    expect(!!screen.queryByTestId("text-short-horizon-caveat")).toBe(caveat);
    if (horizon !== null && horizon !== "unsure") {
      expect(screen.getByText(/Years start at/).textContent).toContain(`Years start at ${years} from your time horizon answer; change them freely.`);
    } else {
      expect(screen.queryByText(/Years start at/)).toBeNull();
    }
  });

  it("prefills from answers refreshed from the server while Wealth was unmounted", async () => {
    const firstVisit = await load(answers({ horizon: "over-10", goals: ["Retirement"] }));
    expectInputs(defaults);
    expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 25 from your time horizon answer; change them freely.");
    expect(screen.queryByTestId("text-short-horizon-caveat")).toBeNull();
    firstVisit.unmount();
    expect(screen.queryByTestId("input-years")).toBeNull();

    const saved = answers({ horizon: "3-5", goals: ["Homeownership"] });
    fetchMock.mockImplementation(async () => response(saved));
    const callsBefore = fetchMock.mock.calls.length;
    // Refresh the retained, inactive query as another page could after saving.
    await act(async () => {
      await client.invalidateQueries({ queryKey, refetchType: "all" });
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(client.getQueryData(queryKey)).toEqual(saved);
    expect(screen.queryByTestId("input-years")).toBeNull();

    mount();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expectInputs({ ...defaults, years: 5 });
    expectProjection({ ...defaults, years: 5 });
    expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 5 from your time horizon answer; change them freely.");
    expect(screen.getByTestId("panel-wealth-context").textContent).toContain("Framed around your goal: Buying a home");
    expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull();
  });

  it("keeps a long applied horizon explanation while a new short horizon updates the caveat", async () => {
    await load(answers({ horizon: "over-10" }));
    await refetch(answers({ horizon: "under-3" }));
    expectInputs(defaults);
    expectProjection(defaults);
    expect(screen.getByText(/Years start at/).textContent).toContain("Years start at 25 from your time horizon answer; change them freely.");
    expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull();
  });

  it("does not claim a prefill when saved answers initially had no horizon", async () => {
    await load(answers());
    await refetch(answers({ horizon: "under-3" }));
    expectInputs(defaults);
    expectProjection(defaults);
    expect(screen.queryByText(/Years start at/)).toBeNull();
    expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull();
  });

  it("keeps all manual edits, including 7 years, through focus and background refetches", async () => {
    await load(answers({ horizon: "under-3" }));
    const expected = { start: 2300, monthly: 280, rate: 6.5, years: 7 };
    for (const key of Object.keys(expected) as (keyof Inputs)[]) edit(key, expected[key]);
    expect(screen.queryByText(/Years start at/)).toBeNull();
    for (const focus of [true, false]) {
      await refetch(answers({ horizon: focus ? "3-5" : "5-10", goals: [focus ? "Business" : "Learning"] }), focus);
      expectInputs(expected);
      expectProjection(expected);
      expect(!!screen.queryByTestId("text-short-horizon-caveat")).toBe(focus);
      expect(screen.queryByText(/Years start at/)).toBeNull();
    }
  });

  it("treats a keyboard slider edit as manual before a late response", async () => {
    const resolve = delayAnswers();
    mount();
    const yearsSlider = screen.getAllByRole("slider")[3];
    fireEvent.keyDown(yearsSlider, { key: "ArrowRight" });
    expect(input("years").value).toBe("26");
    await act(async () => { resolve(answers({ horizon: "under-3" })); });
    await waitFor(() => expect(screen.queryByTestId("text-short-horizon-caveat")).not.toBeNull());
    expectInputs({ ...defaults, years: 26 });
    expectProjection({ ...defaults, years: 26 });
  });

  it.each([
    ["under-3", 40, true], ["3-5", 30, true], ["over-10", 2, false], ["unsure", 1, false],
  ] as const)("caveats follow saved horizon %s, not manually chosen %s years", async (horizon, years, caveat) => {
    await load(answers({ horizon }));
    edit("years", years);
    expect(!!screen.queryByTestId("text-short-horizon-caveat")).toBe(caveat);
    expectProjection({ ...defaults, years });
  });
});
