import { StrictMode, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { getGetPersonalizationQueryKey, getGetWorkspaceQueryKey, type Preferences, type Workspace } from "@workspace/api-client-react";
import { EMPTY_PREFS } from "@/lib/personalize";

// Only HTTP is replaced: components, generated client, preferences hooks,
// mutation callbacks, React Query, routing, and confirmation dialogs are real.
export const prefsKey = getGetPersonalizationQueryKey();
export const workspaceKey = getGetWorkspaceQueryKey();
export const answers = (patch: Partial<Preferences> = {}): Preferences => ({
  ...structuredClone(EMPTY_PREFS), ...patch,
});
const timestamp = "2026-11-14T12:00:00.000Z";
export const financialRecords = {
  holdings: [{
    id: "holding-1", symbol: "VTI", name: "Total market", type: "ETF", quantity: 4,
    priceCents: 25000, costBasisCents: 80000, notes: "Keep this holding",
    priceDate: "2026-11-14", isSample: false, updatedAt: timestamp,
  }],
  theses: [{
    id: "thesis-1", symbol: "VTI", title: "Keep my journal", status: "Researching",
    reasoning: "Long-term plan", risks: "Market risk", createdAt: timestamp, updatedAt: timestamp,
  }],
  entries: [{
    id: "entry-1", description: "Groceries", category: "Food", amountCents: 4200,
    type: "Expense", date: "2026-11-14", notes: "Keep this entry", createdAt: timestamp,
  }],
  budgetLimits: { "2026-11": 20000 },
} satisfies Pick<Workspace, "holdings" | "theses" | "entries" | "budgetLimits">;

export function persistenceHarness() {
  let client: QueryClient;
  let saved: Preferences;
  let getError = false;
  let putError = false;
  let holdPut: Promise<void> | undefined;
  let serverReply: Preferences | undefined;
  const writes: Preferences[] = [];
  const requests: { path: string; method: string }[] = [];
  const financialKey = ["financial-records-sentinel"];

  beforeEach(() => {
    saved = answers();
    getError = putError = false;
    holdPut = undefined;
    serverReply = undefined;
    writes.length = requests.length = 0;
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    client.setQueryData(workspaceKey, structuredClone(financialRecords));
    client.setQueryData(financialKey, structuredClone(financialRecords));
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      requests.push({ path, method });
      // Fail closed: an accidental login, record mutation, or AI request fails.
      if (path !== "/api/workspace/personalization") throw new Error(`Unexpected HTTP request: ${method} ${path}`);
      if (method === "GET") return getError
        ? Response.json({ message: "Setup unavailable" }, { status: 503 })
        : Response.json(saved);
      if (method !== "PUT") throw new Error(`Unexpected HTTP method: ${method}`);
      const data = JSON.parse(String(init?.body)) as Preferences;
      writes.push(data);
      await holdPut;
      if (putError) return Response.json({ message: "Save unavailable" }, { status: 503 });
      saved = structuredClone(serverReply ?? data);
      return Response.json(saved);
    }));
  });

  afterEach(() => {
    // Cache/data isolation is a client contract here, not a simulated assertion
    // about database behavior. Server privacy/recovery has its own guest suite.
    expect(client.getQueryData(workspaceKey)).toEqual(financialRecords);
    expect(client.getQueryData(financialKey)).toEqual(financialRecords);
    expect(requests.every(({ path, method }) =>
      path === "/api/workspace/personalization" && ["GET", "PUT"].includes(method))).toBe(true);
    cleanup();
    client.clear();
    vi.unstubAllGlobals();
  });

  return {
    get client() { return client; },
    get saved() { return saved; },
    writes,
    requests,
    seed(prefs: Preferences) { saved = structuredClone(prefs); },
    failLoad(fail = true) { getError = fail; },
    failSave(fail = true) { putError = fail; },
    replyWith(prefs: Preferences) { serverReply = prefs; },
    pauseSave() {
      let release!: () => void;
      holdPut = new Promise<void>((resolve) => { release = resolve; });
      return release;
    },
    mount(children: ReactNode, path = "/settings") {
      const location = memoryLocation({ path, record: true });
      return {
        ...render(<StrictMode><QueryClientProvider client={client}>
          <Router hook={location.hook}>{children}</Router>
        </QueryClientProvider></StrictMode>),
        location,
      };
    },
    async loaded() {
      await waitFor(() => expect(client.getQueryData(prefsKey)).toEqual(saved));
      await waitFor(() => expect(client.isFetching()).toBe(0));
    },
    async refetch(prefs: Preferences) {
      saved = structuredClone(prefs);
      await act(async () => { await client.invalidateQueries({ queryKey: prefsKey }); });
      await waitFor(() => expect(client.getQueryData(prefsKey)).toEqual(prefs));
    },
    async savedAs(prefs: Preferences) {
      await waitFor(() => expect(client.getQueryData(prefsKey)).toEqual(prefs));
      expect(saved).toEqual(prefs);
      expect(client.getQueryState(workspaceKey)?.isInvalidated).toBe(true);
    },
  };
}

export const click = (id: string) => fireEvent.click(screen.getByTestId(id));
export const checked = (key: string, value: string) => screen.getByTestId<HTMLInputElement>(`input-${key}-${value}`).checked;
export const disabled = (id: string) => screen.getByTestId<HTMLButtonElement>(id).disabled;
