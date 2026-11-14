import type { APIRequestContext, APIResponse, BrowserContext } from "@playwright/test";
import {
  GetWorkspaceResponse, GetOverviewResponse, GetBudgetSummaryResponse,
  CreateHoldingResponse, CreateThesisResponse, CreateBudgetEntryResponse,
  CreateRecoveryKeyResponse, GetLearningTopicsResponse,
  type HoldingInput, type ThesisInput, type BudgetEntryInput,
} from "@workspace/api-zod";
import { test, expect } from "./fixture";

const holding: HoldingInput = {
  symbol: "PRIVATE", name: "Private test holding", type: "Stock",
  quantity: 2, priceCents: 1234, costBasisCents: null,
  notes: "Disposable regression data", priceDate: "2026-01-31",
};
const thesis: ThesisInput = {
  symbol: "PRIVATE", title: "Private reasoning", reasoning: "Test only",
  risks: "Test only", status: "Researching",
};
const entry: BudgetEntryInput = {
  description: "Private expense", category: "Food", type: "Expense",
  amountCents: 10, date: "2026-01-31", notes: "",
};
async function ok(response: APIResponse, status = 200) {
  expect(response.status(), `${response.url()} response status`).toBe(status);
  return response.json();
}
async function workspace(api: APIRequestContext, url: string) {
  const response = await api.get(`${url}/api/workspace`);
  expect(response.headers()["cache-control"]).toBe("no-store");
  return GetWorkspaceResponse.parse(await ok(response));
}
async function createHolding(api: APIRequestContext, url: string, input = holding) {
  return CreateHoldingResponse.parse(await ok(await api.post(`${url}/api/holdings`, { data: input }), 201));
}
async function recovery(api: APIRequestContext, url: string) {
  return CreateRecoveryKeyResponse.parse(await ok(await api.post(`${url}/api/workspace/recovery`))).key;
}
async function disposable<T>(browser: { newContext: () => Promise<BrowserContext> }, run: (context: BrowserContext) => Promise<T>) {
  const context = await browser.newContext();
  try { return await run(context); } finally { await context.close(); }
}

test("independent browser identities start empty without login and survive reload and an API process restart", async ({ browser, site }) => {
  await disposable(browser, async (a) => {
    await disposable(browser, async (b) => {
      const page = await a.newPage();
      await page.goto(`${site.url}/settings`);
      await expect(page.getByTestId("input-pref-name")).toBeVisible();
      const first = await workspace(a.request, site.url);
      const second = await workspace(b.request, site.url);
      expect(first.id).not.toBe(second.id);
      for (const w of [first, second]) {
        expect(w.holdings).toEqual([]); expect(w.theses).toEqual([]); expect(w.entries).toEqual([]);
        expect(w.hasRecoveryKey).toBe(false);
      }
      const cookie = (await a.cookies()).find((c) => c.name === "piq_guest");
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
      expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 3600 * 24 * 350);
      await page.getByTestId("input-pref-name").fill("Saved after restart");
      await page.getByTestId("button-save-prefs").click();
      await expect(page.getByText("Preferences saved", { exact: true })).toBeVisible();
      const saved = await createHolding(a.request, site.url);
      const savedThesis = CreateThesisResponse.parse(await ok(await a.request.post(`${site.url}/api/theses`, { data: thesis }), 201));
      const savedEntry = CreateBudgetEntryResponse.parse(await ok(await a.request.post(`${site.url}/api/budget/entries`, { data: entry }), 201));
      await ok(await a.request.put(`${site.url}/api/budget/limit`, { data: { month: "2026-01", limitCents: 101 } }));
      const topics = GetLearningTopicsResponse.parse(await ok(await a.request.get(`${site.url}/api/learning`)));
      await ok(await a.request.put(`${site.url}/api/learning/${topics[0].id}`, { data: { bookmarked: true } }));
      const key = await recovery(a.request, site.url);
      await page.reload();
      await expect(page.getByTestId("input-pref-name")).toHaveValue("Saved after restart");
      await site.restartApi(); // new Node process, same disposable Postgres schema and browser cookie
      await page.reload();
      await expect(page.getByTestId("input-pref-name")).toHaveValue("Saved after restart");
      const persisted = await workspace(a.request, site.url);
      expect(persisted).toMatchObject({
        id: first.id, name: "Saved after restart", holdings: [saved],
        theses: [savedThesis], entries: [savedEntry], budgetLimits: { "2026-01": 101 }, hasRecoveryKey: true,
      });
      const savedTopics = GetLearningTopicsResponse.parse(await ok(await a.request.get(`${site.url}/api/learning`)));
      expect(savedTopics.find((t) => t.id === topics[0].id)?.bookmarked).toBe(true);
      expect((await workspace(b.request, site.url)).holdings).toEqual([]);
      await b.clearCookies();
      await ok(await b.request.post(`${site.url}/api/workspace/restore`, { data: { key } }));
      expect((await workspace(b.request, site.url)).id).toBe(first.id);
      // Without either cookie or key, the same browser gets a new empty workspace.
      await b.clearCookies();
      const fresh = await workspace(b.request, site.url);
      expect(fresh.id).not.toBe(first.id); expect(fresh.holdings).toEqual([]);
    });
  });
});

test("guest API rejects missing, forged and expired sessions; secure cookies remain private", async ({ browser, site }) => {
  await disposable(browser, async (context) => {
    const api = context.request;
    for (const path of ["/overview", "/budget?month=2026-01", "/learning"]) {
      expect((await api.get(`${site.url}/api${path}`)).status()).toBe(401);
    }
    expect((await api.post(`${site.url}/api/holdings`, { data: holding })).status()).toBe(401);
    await context.addCookies([{ name: "piq_guest", value: "a".repeat(64), url: site.url }]);
    expect((await api.get(`${site.url}/api/overview`)).status()).toBe(401);
    const secured = await api.get(`${site.url}/api/workspace`, { headers: { "x-forwarded-proto": "https" } });
    expect(secured.status()).toBe(200);
    expect(secured.headers()["set-cookie"]).toMatch(/__Host-piq_guest=.*; Path=\/; .*HttpOnly; Secure; SameSite=Lax/);
    // A still-present cookie must be rejected when its server session expires.
    await context.clearCookies();
    const old = await workspace(api, site.url);
    const cookie = (await context.cookies()).find((c) => c.name === "piq_guest")!;
    await site.expireSession(cookie.value);
    expect((await api.get(`${site.url}/api/overview`)).status()).toBe(401);
    expect((await workspace(api, site.url)).id).not.toBe(old.id);
  });
});

test("foreign record identifiers cannot read, edit or delete another workspace", async ({ browser, site }) => {
  await disposable(browser, async (a) => disposable(browser, async (b) => {
    const owner = await workspace(a.request, site.url);
    const stranger = await workspace(b.request, site.url);
    const h = await createHolding(a.request, site.url);
    const t = CreateThesisResponse.parse(await ok(await a.request.post(`${site.url}/api/theses`, { data: thesis }), 201));
    const e = CreateBudgetEntryResponse.parse(await ok(await a.request.post(`${site.url}/api/budget/entries`, { data: entry }), 201));
    await ok(await a.request.patch(`${site.url}/api/workspace`, { data: { name: "Private owner", experience: "Advanced", goal: "Private goal" } }));
    await ok(await a.request.put(`${site.url}/api/budget/limit`, { data: { month: "2026-01", limitCents: 12345 } }));
    const before = await workspace(a.request, site.url);
    // Query/body ownership claims must not override the HttpOnly cookie.
    const bView = GetWorkspaceResponse.parse(await ok(await b.request.get(`${site.url}/api/workspace?workspaceId=${owner.id}&id=${owner.id}`)));
    expect(bView.id).toBe(stranger.id);
    expect(bView.holdings).toEqual([]); expect(bView.theses).toEqual([]); expect(bView.entries).toEqual([]);
    expect(bView.name).toBe(""); expect(bView.goal).toBe(""); expect(bView.budgetLimits).toEqual({});
    const summary = GetOverviewResponse.parse(await ok(await b.request.get(`${site.url}/api/overview?workspaceId=${owner.id}`)));
    expect(summary.totalValueCents).toBe(0);
    const budget = GetBudgetSummaryResponse.parse(await ok(await b.request.get(`${site.url}/api/budget?month=2026-01&workspaceId=${owner.id}`)));
    expect(budget.expenseCents).toBe(0); expect(budget.limitCents).toBe(0);
    for (const [path, record, input] of [
      ["holdings", h, holding], ["theses", t, thesis], ["budget/entries", e, entry],
    ] as const) {
      const url = `${site.url}/api/${path}/${record.id}`;
      expect((await b.request.get(url)).status()).toBe(404);
      expect((await b.request.put(url, { data: { ...input, workspaceId: owner.id } })).status()).toBe(404);
      expect((await b.request.delete(url)).status()).toBe(404);
    }
    await ok(await b.request.patch(`${site.url}/api/workspace`, {
      data: { id: owner.id, workspaceId: owner.id, name: "Stranger", experience: "Beginner", goal: "" },
    }));
    expect(await workspace(a.request, site.url)).toEqual(before);
    // Legitimate edits and deletes still work, not just a blanket rejection.
    await ok(await a.request.put(`${site.url}/api/holdings/${h.id}`, { data: { ...holding, notes: "Edited" } }));
    for (const [path, id] of [["holdings", h.id], ["theses", t.id], ["budget/entries", e.id]]) {
      expect((await a.request.delete(`${site.url}/api/${path}/${id}`)).status()).toBe(204);
    }
  }));
});

test("invalid and replaced recovery keys leave the current session untouched", async ({ browser, site }) => {
  await disposable(browser, async (a) => disposable(browser, async (b) => {
    const owner = await workspace(a.request, site.url);
    const current = await workspace(b.request, site.url);
    const oldKey = await recovery(a.request, site.url);
    const newKey = await recovery(a.request, site.url);
    expect(newKey === oldKey).toBe(false);
    for (const key of ["not-a-key", `piq_${"x".repeat(43)}`, oldKey]) {
      const failed = await b.request.post(`${site.url}/api/workspace/restore`, { data: { key } });
      expect(failed.status()).toBe(400);
      expect(failed.headers()["set-cookie"]).toBeUndefined();
      expect((await workspace(b.request, site.url)).id).toBe(current.id);
    }
    const restored = GetWorkspaceResponse.parse(await ok(await b.request.post(`${site.url}/api/workspace/restore`, { data: { key: ` ${newKey} ` } })));
    expect(restored.id).toBe(owner.id);
    const publicData = JSON.stringify(await workspace(b.request, site.url));
    expect(publicData.includes(newKey)).toBe(false);
    expect(publicData).not.toContain("recoveryHash");
    expect(publicData).not.toContain("tokenHash");
  }));
});

test("concurrent tabs preserve unrelated edits and roll back rejected writes", async ({ browser, site }) => {
  await disposable(browser, async (context) => {
    await workspace(context.request, site.url);
    const api = context.request;
    const h = await createHolding(api, site.url);
    const other = await createHolding(api, site.url, { ...holding, symbol: "OTHER" });
    const topics = GetLearningTopicsResponse.parse(await ok(await api.get(`${site.url}/api/learning`)));
    await Promise.all([
      ...Array.from({ length: 12 }, (_, i) => createHolding(api, site.url, { ...holding, symbol: `TAB${i}` })),
      api.patch(`${site.url}/api/workspace`, { data: { name: "Concurrent", experience: "Intermediate", goal: "Preserve me" } }).then(ok),
      ...Array.from({ length: 4 }, async (_, i) => ok(await api.post(`${site.url}/api/budget/entries`, { data: { ...entry, description: `Entry ${i}` } }), 201)),
      (async () => ok(await api.put(`${site.url}/api/budget/limit`, { data: { month: "2026-01", limitCents: 999 } })))(),
      api.put(`${site.url}/api/holdings/${h.id}`, { data: { ...holding, notes: "First tab edit" } }).then(ok),
      api.put(`${site.url}/api/holdings/${other.id}`, { data: { ...holding, symbol: "OTHER", notes: "Second tab edit" } }).then(ok),
      ...topics.slice(0, 2).map((topic) => api.put(`${site.url}/api/learning/${topic.id}`, { data: { bookmarked: true } }).then(ok)),
    ]);
    const after = await workspace(api, site.url);
    expect(after.holdings).toHaveLength(14); expect(new Set(after.holdings.map((x) => x.id)).size).toBe(14);
    expect(after.holdings.find((x) => x.id === h.id)?.notes).toBe("First tab edit");
    expect(after.holdings.find((x) => x.id === other.id)?.notes).toBe("Second tab edit");
    expect(after.entries).toHaveLength(4);
    expect(after).toMatchObject({ name: "Concurrent", goal: "Preserve me", budgetLimits: { "2026-01": 999 } });
    const learning = GetLearningTopicsResponse.parse(await ok(await api.get(`${site.url}/api/learning`)));
    expect(learning.filter((t) => t.bookmarked).map((t) => t.id).sort()).toEqual(topics.slice(0, 2).map((t) => t.id).sort());
    // Two deletions of the same record cannot both succeed or remove another.
    const deletes = await Promise.all([api.delete(`${site.url}/api/holdings/${h.id}`), api.delete(`${site.url}/api/holdings/${h.id}`)]);
    expect(deletes.map((r) => r.status()).sort()).toEqual([204, 404]);
    const beforeRejected = await workspace(api, site.url);
    expect((await api.post(`${site.url}/api/budget/entries`, { data: { ...entry, date: "2026-02-30" } })).status()).toBe(400);
    expect(await workspace(api, site.url)).toEqual(beforeRejected);
  });
});

test("unknown cost basis stays null and never inflates gains; explicit zero is known", async ({ browser, site }) => {
  await disposable(browser, async (context) => {
    const api = context.request;
    await workspace(api, site.url);
    const h = await createHolding(api, site.url);
    const overview = async () => GetOverviewResponse.parse(await ok(await api.get(`${site.url}/api/overview`)));
    expect(await overview()).toMatchObject({ totalValueCents: 2468, knownCostCount: 0, gainCents: null, gainPercent: null });
    const page = await context.newPage();
    await page.goto(site.url);
    await expect(page.getByTestId("text-gain")).toHaveText("Unknown");
    const changed = { ...holding, symbol: "KNOWN", priceCents: 1000, costBasisCents: 1500 };
    await createHolding(api, site.url, changed);
    expect(await overview()).toMatchObject({ totalValueCents: 4468, totalCostBasisCents: 1500, knownCostCount: 1, gainCents: 500 });
    await ok(await api.put(`${site.url}/api/holdings/${h.id}`, { data: { ...holding, costBasisCents: 0 } }));
    expect(await overview()).toMatchObject({ knownCostCount: 2, gainCents: 2968 });
    await ok(await api.put(`${site.url}/api/holdings/${h.id}`, { data: holding }));
    expect((await workspace(api, site.url)).holdings.find((x) => x.id === h.id)?.costBasisCents).toBeNull();
    expect(await overview()).toMatchObject({ knownCostCount: 1, gainCents: 500 });
    await page.reload();
    await expect(page.getByTestId("text-gain")).toContainText("$5.00");
  });
});

test("monthly budgeting uses exact cents and respects month boundaries after edits and deletes", async ({ browser, site }) => {
  await disposable(browser, async (context) => {
    const api = context.request;
    await workspace(api, site.url);
    const add = async (data: BudgetEntryInput) => CreateBudgetEntryResponse.parse(await ok(await api.post(`${site.url}/api/budget/entries`, { data }), 201));
    const ten = await add(entry);
    await add({ ...entry, amountCents: 20 });
    await add({ ...entry, amountCents: 1, category: "Other", date: "2026-01-01" });
    await add({ ...entry, type: "Income", amountCents: 100 });
    await add({ ...entry, amountCents: 888, date: "2025-12-31" });
    await add({ ...entry, amountCents: 999, date: "2026-02-01" });
    await ok(await api.put(`${site.url}/api/budget/limit`, { data: { month: "2026-01", limitCents: 30 } }));
    const summary = async (month = "2026-01") => GetBudgetSummaryResponse.parse(await ok(await api.get(`${site.url}/api/budget?month=${month}`)));
    expect(await summary()).toEqual({
      month: "2026-01", incomeCents: 100, expenseCents: 31, balanceCents: 69, limitCents: 30,
      categories: [{ category: "Food", amountCents: 30 }, { category: "Other", amountCents: 1 }],
    });
    expect(await summary("2026-02")).toMatchObject({ incomeCents: 0, expenseCents: 999, balanceCents: -999, limitCents: 0 });
    for (const amountCents of [0, -1, 1.5, 100000000001]) {
      expect((await api.post(`${site.url}/api/budget/entries`, { data: { ...entry, amountCents } })).status()).toBe(400);
    }
    await ok(await api.put(`${site.url}/api/budget/entries/${ten.id}`, { data: { ...entry, amountCents: 11 } }));
    expect(await summary()).toMatchObject({ expenseCents: 32, balanceCents: 68 });
    expect((await api.delete(`${site.url}/api/budget/entries/${ten.id}`)).status()).toBe(204);
    expect(await summary()).toMatchObject({ expenseCents: 21, balanceCents: 79 });
    expect((await api.get(`${site.url}/api/budget?month=2026-13`)).status()).toBe(400);
  });
});

test("restoring through Settings clears cached records, assistant history, draft and consent", async ({ browser, site }) => {
  await disposable(browser, async (a) => disposable(browser, async (b) => {
    await workspace(a.request, site.url);
    const owner = await workspace(b.request, site.url);
    await createHolding(a.request, site.url, { ...holding, symbol: "OLD", name: "Old private holding" });
    await createHolding(b.request, site.url, { ...holding, symbol: "NEW", name: "Restored holding", priceCents: 4936 });
    await ok(await b.request.patch(`${site.url}/api/workspace`, { data: { name: "Restored visitor", experience: "Advanced", goal: "New goal" } }));
    for (const [context, experience] of [[a, "new"], [b, "experienced"]] as const) {
      await ok(await context.request.put(`${site.url}/api/workspace/personalization`, { data: {
        status: "completed", experience, objectives: [], brokerages: [], accountTypes: [],
        goals: [], horizon: null, learning: [],
      } }));
    }
    const key = await recovery(b.request, site.url);
    const page = await a.newPage();
    // Only the external AI answer is stubbed. Restore, cookies and portfolio
    // queries use real handlers and PostgreSQL; no paid AI requests are made.
    await page.route("**/api/assistant", (route) => route.fulfill({ json: { answer: "Old workspace private answer" } }));
    await page.goto(site.url);
    await expect(page.getByTestId("text-total-value")).toHaveText("$24.68");
    await page.getByTestId("link-nav-holdings").click();
    await expect(page.getByText("Old private holding", { exact: true })).toBeVisible();
    await page.getByTestId("button-open-assistant").click();
    await page.getByTestId("input-question").fill("Old private question");
    await page.getByTestId("switch-include-portfolio").click();
    await page.getByTestId("button-send").click();
    await expect(page.getByTestId("text-answer-0")).toContainText("Old workspace private answer");
    await page.getByTestId("input-question").fill("Unsent private draft");
    await page.keyboard.press("Escape");
    // Navigate in-app: a full navigation would hide missing cache cleanup.
    await page.getByTestId("link-nav-settings").click();
    await expect(page.getByTestId("text-legacy-experience")).toContainText("I am completely new");
    await page.getByTestId("input-restore-key").fill(key);
    await page.getByTestId("button-restore").click();
    await page.getByTestId("button-confirm-restore").click();
    await expect(page.getByTestId("input-pref-name")).toHaveValue("Restored visitor");
    await expect(page.getByTestId("text-legacy-experience")).toContainText("I am experienced");
    await expect(page.getByTestId("button-save-prefs")).toBeDisabled();
    await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
    expect((await workspace(a.request, site.url)).id).toBe(owner.id);
    await page.getByTestId("button-open-assistant").click();
    await expect(page.getByTestId("input-question")).toHaveValue("");
    await expect(page.getByTestId("switch-include-portfolio")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("text-answer-0")).toHaveCount(0);
    await page.keyboard.press("Escape");
    // Freeze the new summary request so a stale-cache flash cannot pass just
    // because a fast refetch eventually replaces the old workspace's values.
    let releaseOverview!: () => void;
    const overviewGate = new Promise<void>((resolve) => { releaseOverview = resolve; });
    await page.route("**/api/overview", async (route) => { await overviewGate; await route.continue(); });
    try {
      const requested = page.waitForRequest((req) => req.url().endsWith("/api/overview"), { timeout: 10_000 });
      await page.getByTestId("link-nav-overview").click();
      await requested;
      await expect(page.getByTestId("text-total-value")).toHaveCount(0);
    } finally { releaseOverview(); }
    await expect(page.getByTestId("text-total-value")).toHaveText("$98.72");
    await page.getByTestId("link-nav-holdings").click();
    await expect(page.getByText("Restored holding", { exact: true })).toBeVisible();
    await expect(page.getByText("Old private holding", { exact: true })).toHaveCount(0);
    // Reload confirms that the actual browser cookie, not just cached data, switched.
    await page.reload();
    await expect(page.getByText("Restored holding", { exact: true })).toBeVisible();
  }));
});
