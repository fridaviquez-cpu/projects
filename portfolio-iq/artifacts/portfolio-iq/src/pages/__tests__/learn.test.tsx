import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import {
  getGetLearningTopicsQueryKey, getGetPersonalizationQueryKey,
  type LearningProgressInput, type LearningTopic, type Preferences, type Workspace,
} from "@workspace/api-client-react";
import { Shell } from "@/components/shell";
import Learn from "../learn";

// Only HTTP is replaced. The page, preferences, generated client, query/mutation
// callbacks, Radix dialogs, Shell event listener, and assistant draft are real.
// Fixtures deliberately do not call rankLessons/learnStyle/shapeContent.
const paragraphs = [
  "Compounding builds on earlier growth. Gains can earn gains too.",
  "Time gives growth more opportunities. Start with a clear time horizon.",
  "Contributions add new money. Regular deposits are separate from returns.",
  "Returns can fall below expectations. No investment outcome is guaranteed.",
];
const compound: LearningTopic = {
  id: "compound", title: "How compounding works", track: "Growth",
  description: "Learn what happens when gains stay invested.",
  content: paragraphs.join("\n\n"), minutes: 4, level: "Beginner",
  risk: "Actual returns vary.", evidence: "Educational explanation",
  question: "What can earn future growth?", options: ["Only deposits", "Deposits and past gains"],
  sources: [{ title: "Compound interest", publisher: "Investor.gov", url: "https://www.investor.gov/" }],
  completed: false, bookmarked: false,
};
const catalog: LearningTopic[] = [
  { ...compound, id: "finished", title: "What is compound growth?", completed: true },
  compound,
  { ...compound, id: "risk", title: "Diversification and risk", track: "Risk", minutes: 6 },
];
const initialPrefs: Preferences = {
  status: "completed", experience: "basics", objectives: ["learn", "diversification"],
  brokerages: [], accountTypes: [], goals: [], horizon: null, learning: ["simple"],
};
const workspace: Workspace = {
  id: "test-workspace", name: "Test workspace", experience: "Beginner", goal: "",
  holdings: [], theses: [], entries: [], budgetLimits: {}, hasRecoveryKey: false,
  createdAt: "2026-11-14T12:00:00.000Z", updatedAt: "2026-11-14T12:00:00.000Z",
};
const topicsKey = getGetLearningTopicsQueryKey();
const prefsKey = getGetPersonalizationQueryKey();
let client: QueryClient;
let prefs: Preferences;
let topics: LearningTopic[];
let pendingWrite: Promise<void> | undefined;
const requests: { path: string; method: string }[] = [];
const writes: { id: string; data: LearningProgressInput }[] = [];

beforeEach(() => {
  // jsdom has no layout observer; Radix uses it to size the assistant switch.
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  prefs = structuredClone(initialPrefs);
  topics = structuredClone(catalog);
  pendingWrite = undefined;
  requests.length = writes.length = 0;
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    requests.push({ path, method });
    if (method === "GET") {
      if (path === "/api/learning") return Response.json(topics);
      if (path === "/api/workspace/personalization") return Response.json(prefs);
      if (path === "/api/workspace") return Response.json(workspace);
    }
    const id = path.match(/^\/api\/learning\/([^/]+)$/)?.[1];
    if (method === "PUT" && id) {
      const topic = topics.find((t) => t.id === id);
      if (!topic) throw new Error(`Unknown lesson: ${id}`);
      const data = JSON.parse(String(init?.body)) as LearningProgressInput;
      writes.push({ id, data });
      await pendingWrite;
      if (data.answer !== undefined) {
        if (data.answer !== 1) return Response.json({ message: "Try again." }, { status: 400 });
        topic.completed = true;
      }
      if (data.bookmarked !== undefined) topic.bookmarked = data.bookmarked;
      return Response.json(topic);
    }
    // Record AND reject unexpected requests: a swallowed mutation error must
    // not let an accidental AI call pass the draft-only assertions.
    throw new Error(`Unexpected HTTP request: ${method} ${path}`);
  }));
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  expect(requests.filter(({ path, method }) => !(
    method === "GET" && ["/api/learning", "/api/workspace/personalization", "/api/workspace"].includes(path)
    || method === "PUT" && /^\/api\/learning\/[^/]+$/.test(path)
  ))).toEqual([]);
});

async function mount(learning: Preferences["learning"] = ["simple"], shell = false) {
  prefs.learning = learning;
  const location = memoryLocation({ path: "/learn" });
  render(<StrictMode><QueryClientProvider client={client}>
    <Router hook={location.hook}>{shell ? <Shell><Learn /></Shell> : <Learn />}</Router>
  </QueryClientProvider></StrictMode>);
  await screen.findByTestId("card-lesson-compound");
  await waitFor(() => expect(client.getQueryData(prefsKey)).toEqual(prefs));
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

async function openLesson(recommended = false) {
  fireEvent.click(screen.getByTestId(`card-${recommended ? "recommended" : "lesson"}-compound`));
  return screen.findByRole("dialog", { name: compound.title });
}

function expectDepth(depth: "simple" | "detailed") {
  const content = screen.getByTestId("text-lesson-content");
  expect([...content.children].filter((el) => el.tagName === "P").map((el) => el.textContent))
    .toEqual(depth === "simple" ? paragraphs.slice(0, 2) : paragraphs);
  const folded = screen.queryByTestId<HTMLDetailsElement>("details-lesson-more");
  if (depth === "simple") {
    expect(folded).not.toBeNull();
    expect(folded!.open).toBe(false);
    expect(within(folded!).getByText("Read the rest (2 more paragraphs)")).toBeTruthy();
    expect([...folded!.querySelectorAll("p")].map((el) => el.textContent)).toEqual(paragraphs.slice(2));
  } else {
    expect(folded).toBeNull();
  }
}

describe("Learn page preference wiring", () => {
  it("shows relevance on actual cards and keeps completed lessons out of Start here", async () => {
    await mount();
    const picks = screen.getByRole("region", { name: "Start here" });
    expect(within(picks).getAllByRole("button").map((el) => el.dataset.testid)).toEqual([
      "card-recommended-compound", "card-recommended-risk",
    ]);
    expect(within(picks).getByTestId("text-reason-compound").textContent)
      .toBe("Matches: learn how investing works");
    expect(within(picks).getByTestId("text-reason-risk").textContent)
      .toBe("Matches: check my diversification");
    expect(screen.getByTestId("card-lesson-compound").textContent).toContain("Matches: learn how investing works");
    expect(screen.getByTestId("card-lesson-risk").textContent).toContain("Matches: check my diversification");
    expect(screen.getByTestId("card-lesson-finished").textContent).toContain("What is compound growth?");
    expect(screen.getByTestId("text-progress").textContent).toBe("1/3");
    expect(screen.getByTestId("link-learn-preferences").getAttribute("href")).toBe("/settings");
    expect(writes).toEqual([]);
  });

  it.each(["simple", "detailed"] as const)("opens %s reading from a real lesson card", async (depth) => {
    await mount([depth]);
    await openLesson(depth === "simple");
    expectDepth(depth);
    expect(screen.getByTestId("text-learn-style").firstElementChild?.textContent)
      .toBe(`Lessons shown as: ${depth === "simple" ? "Plain-language summaries" : "Full detail"}`);
    // Without quiz preference the question follows the text; optional surfaces
    // must not leak into the default lesson layout.
    expect(screen.getByTestId("text-lesson-content").compareDocumentPosition(screen.getByRole("radiogroup"))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("text-quiz-first")).toBeNull();
    expect(screen.queryByTestId("figure-key-points")).toBeNull();
    expect(screen.queryByTestId("panel-try-it")).toBeNull();
    expect((screen.getByRole("button", { name: "Check answer" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["quizzes", "visual", "interactive"] as const)("renders the %s preference in the lesson", async (feature) => {
    await mount(["simple", feature]);
    const dialog = await openLesson();
    expectDepth("simple");
    expect(!!within(dialog).queryByTestId("text-quiz-first")).toBe(feature === "quizzes");
    expect(!!within(dialog).queryByTestId("figure-key-points")).toBe(feature === "visual");
    expect(!!within(dialog).queryByTestId("panel-try-it")).toBe(feature === "interactive");
    if (feature === "quizzes") {
      expect(within(dialog).getAllByRole("radiogroup")).toHaveLength(1);
      expect(within(dialog).getByRole("radiogroup").compareDocumentPosition(screen.getByTestId("text-lesson-content"))
        & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(dialog).getByText(compound.question)).toBeTruthy();
    } else if (feature === "visual") {
      const figure = within(dialog).getByRole("figure");
      expect(within(figure).getByText("Key points at a glance")).toBeTruthy();
      expect(within(figure).getAllByRole("listitem").map((el) => el.textContent)).toEqual([
        "Compounding builds on earlier growth.", "Time gives growth more opportunities.",
        "Contributions add new money.", "Returns can fall below expectations.",
      ]);
    } else {
      expect(within(dialog).getByTestId("panel-try-it").textContent)
        .toContain(`In two sentences, explain how "${compound.title}" applies to it`);
      expect(within(dialog).getByRole("button", { name: "Draft my example in the assistant" })).toBeTruthy();
    }
  });

  it.each(["simple", "detailed"] as const)(
    "refreshes quiz and bookmark progress without losing %s reading or optional preferences",
    async (depth) => {
      const learning: Preferences["learning"] = [depth, "quizzes", "visual", "interactive"];
      await mount(learning);
      await openLesson();
      const label = `Lessons shown as: ${depth === "simple" ? "Plain-language summaries" : "Full detail"}, questions up front, visual key points, try-it prompts`;
      const expectStyle = () => {
        expect(screen.getByTestId("text-learn-style").firstElementChild?.textContent).toBe(label);
        expectDepth(depth);
        for (const id of ["text-quiz-first", "figure-key-points", "panel-try-it"]) {
          expect(screen.getByTestId(id)).toBeTruthy();
        }
        expect(client.getQueryData(prefsKey)).toEqual({ ...initialPrefs, learning });
      };
      expectStyle();
      let release!: () => void;
      pendingWrite = new Promise<void>((resolve) => { release = resolve; });
      fireEvent.click(screen.getByRole("radio", { name: /Deposits and past gains$/ }));
      expect(screen.getByTestId("button-option-1").getAttribute("aria-checked")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
      await waitFor(() => expect(writes).toEqual([{ id: "compound", data: { answer: 1 } }]));
      expect(screen.getByTestId("text-progress").textContent).toBe("1/3");
      expect((screen.getByTestId("button-check-answer") as HTMLButtonElement).disabled).toBe(true);
      const readsBeforeSave = requests.filter((r) => r.path === "/api/learning" && r.method === "GET").length;
      await act(async () => { release(); });
      await screen.findByText("Correct. Lesson marked complete.");
      await waitFor(() => expect(screen.getByTestId("text-progress").textContent).toBe("2/3"));
      expect(requests.filter((r) => r.path === "/api/learning" && r.method === "GET").length).toBeGreaterThan(readsBeforeSave);
      expect(screen.queryByTestId("card-recommended-compound")).toBeNull();
      expectStyle();

      for (const bookmarked of [true, false]) {
        fireEvent.click(screen.getByTestId("button-bookmark-lesson"));
        await waitFor(() => expect(screen.getByTestId("button-bookmark-lesson").textContent)
          .toBe(bookmarked ? "Saved" : "Save for later"));
        expect(client.getQueryData<LearningTopic[]>(topicsKey)?.find((t) => t.id === "compound"))
          .toMatchObject({ completed: true, bookmarked });
        expect(screen.getByTestId("text-progress").textContent).toBe("2/3");
        expectStyle();
      }
      expect(writes).toEqual([
        { id: "compound", data: { answer: 1 } },
        { id: "compound", data: { bookmarked: true } },
        { id: "compound", data: { bookmarked: false } },
      ]);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await openLesson();
      expectStyle();
      expect(screen.getByTestId("button-bookmark-lesson").textContent).toBe("Save for later");
    },
  );

  it.each([
    ["Ask about this lesson", `Help me understand "How compounding works". Explain it in plain language with an example and one important limitation.`],
    ["Draft my example in the assistant", `I'm practicing "How compounding works". Here is my own example: [describe a holding and how the idea applies]. Is my reasoning sound? Point out one thing I missed.`],
  ])("%s fills the real assistant draft without submitting a request", async (button, draft) => {
    await mount(["interactive"], true);
    await openLesson();
    fireEvent.click(screen.getByRole("button", { name: button }));
    const assistant = await screen.findByRole("dialog", { name: "Think it through" });
    await waitFor(() => expect(within(assistant).getByRole<HTMLTextAreaElement>("textbox", { name: "Your question" }).value)
      .toBe(draft));
    expect(screen.queryByRole("dialog", { name: compound.title })).toBeNull();
    expect(within(assistant).getByTestId("text-assistant-mode").textContent).toBe("Learn · Ask a question");
    expect((within(assistant).getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("text-answer-0")).toBeNull();
    expect(writes).toEqual([]);
    expect(requests.every(({ method }) => method === "GET")).toBe(true);
  });
});
