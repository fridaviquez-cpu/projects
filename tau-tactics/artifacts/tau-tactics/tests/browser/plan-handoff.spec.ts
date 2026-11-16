import { expect, test, type Page } from "@playwright/test";

const keys = { timer: "tau.timer.v1", sessions: "tau.sessions.v1", plans: "tau.plans.v1" };
const plan = {
  id: "saved-plan", name: "Evening recall", task: "Recall cell division",
  duration: 50, ai: "No AI this session", method: "Pomodoro blocks",
  breakStyle: "Walk", notes: "Tue/Thu at Grainger\nBring the diagram notebook",
  createdAt: 1794000000000,
};
const history = [{
  id: "existing-completion", task: "Earlier practice", subject: "Chemistry",
  intention: "Practice", minutes: 25, completedAt: 1793990000000,
  reflection: { recalled: true, practiced: true, takeaway: "Balance charges", unclear: "Oxidation" },
}];
const oldTimer = {
  version: 2, runId: "original-run", duration: 30,
  phases: [{ kind: "focus", minutes: 30 }, { kind: "break", minutes: 7 },
    { kind: "focus", minutes: 30 }, { kind: "break", minutes: 7 }],
  index: 0, status: "idle", endAt: null, remainingMs: 1800000,
  task: "Original task", subject: "Old subject", intention: "Write",
  plan: { name: "Old plan", method: "2-minute warm-up", ai: "No AI this session", breakStyle: "Doodle", notes: "Old notes" },
};

async function seed(page: Page, savedPlans: object[] = [plan], active = false) {
  await page.goto("/plan");
  await page.evaluate(({ keys, savedPlans, history, oldTimer, active }) => {
    localStorage.clear();
    localStorage.setItem(keys.plans, JSON.stringify(savedPlans));
    localStorage.setItem(keys.sessions, JSON.stringify(history));
    localStorage.setItem(keys.timer, JSON.stringify({
      ...oldTimer, ...(active ? { status: "running", endAt: Date.now() + 1800000 } : {}),
    }));
  }, { keys, savedPlans, history, oldTimer, active });
  await page.reload();
  await expect(page.getByTestId("timer-status")).toContainText(active ? "Focus 1 started" : "Focus 1 ready");
}

async function snapshot(page: Page) {
  return page.evaluate(keys => ({
    timer: localStorage.getItem(keys.timer),
    sessions: localStorage.getItem(keys.sessions),
    plans: localStorage.getItem(keys.plans),
  }), keys);
}

async function build(page: Page) {
  await page.getByTestId("button-choice-01-50").click();
  await page.getByRole("button", { name: "Pomodoro blocks", exact: true }).click();
  await page.getByRole("button", { name: "Walk", exact: true }).click();
  await page.getByTestId("button-generate-plan").click();
  await page.getByTestId("input-plan-task").fill(plan.task);
  await page.getByTestId("input-plan-name").fill(plan.name);
  await page.getByTestId("input-plan-notes").fill(plan.notes);
}

async function assertHandoff(page: Page, task = plan.task) {
  await expect(page).toHaveURL(/\/focus$/);
  await expect(page.getByTestId("input-task")).toHaveValue(task);
  await expect(page.getByTestId("input-subject")).toHaveValue("");
  await expect(page.getByTestId("radio-intention-study")).toBeChecked();
  await expect(page.getByTestId("text-clock")).toHaveText("50:00");
  await expect(page.getByTestId("button-start")).toBeEnabled();
  const context = page.getByTestId("focus-plan-context");
  for (const text of [plan.name, plan.method, plan.ai, plan.breakStyle, ...plan.notes.split("\n")]) {
    await expect(context).toContainText(text);
  }
  const stored = await snapshot(page);
  expect(JSON.parse(stored.timer!)).toMatchObject({
    status: "idle", endAt: null, index: 0, task, subject: "", intention: "Study",
    phases: [{ kind: "focus", minutes: 50 }, { kind: "break", minutes: 10 },
      { kind: "focus", minutes: 50 }, { kind: "break", minutes: 10 }],
    plan: { name: plan.name, notes: plan.notes, method: plan.method, ai: plan.ai, breakStyle: plan.breakStyle },
  });
  expect(JSON.parse(stored.sessions!)).toEqual(history);
}

test("new draft hands off all context, stays idle, and survives reload", async ({ page }) => {
  await seed(page, []);
  await build(page);
  await page.getByTestId("button-run-plan").click();
  await assertHandoff(page);
  await page.reload();
  await assertHandoff(page);
});

test("saving a new plan then reopening it hands off the persisted choices", async ({ page }) => {
  await seed(page, []);
  await build(page);
  await page.getByTestId("button-save-plan").click();
  await page.reload();
  const card = page.locator('[data-testid^="card-plan-"]');
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Open in Focus" }).click();
  await assertHandoff(page);
});

test("legacy saved plan without task falls back to its name, never its notes", async ({ page }) => {
  const { task: _task, ...legacy } = plan;
  await seed(page, [legacy]);
  await page.getByTestId("button-run-saved-plan").click();
  await assertHandoff(page, plan.name);
  await page.reload();
  await assertHandoff(page, plan.name);
});

test("no-AI draft and saved copy buttons copy the displayed independent-study protocol", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seed(page);
  await build(page);
  const expected = await page.getByTestId("text-protocol").innerText();
  expect(expected).toContain("INDEPENDENT STUDY (No AI this session)");
  expect(expected).toContain("Focus 50 min / Break 10 min");
  expect(expected).toContain(`Task: ${plan.task}`);
  expect(expected).toContain(plan.notes);
  expect(expected).not.toContain("AI enhances your thinking");
  for (const button of ["button-copy-plan", "button-copy-saved-plan"]) {
    await page.getByTestId(button).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  }
});

for (const source of ["draft", "saved"] as const) {
  test(`cancelling active-run replacement from ${source} preserves timer and history`, async ({ page }) => {
    await seed(page, [plan], true);
    if (source === "draft") await build(page);
    const before = await snapshot(page);
    let prompted = false;
    page.once("dialog", async dialog => {
      prompted = true;
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain("Replace this active run?");
      await dialog.dismiss();
    });
    await page.getByTestId(source === "draft" ? "button-run-plan" : "button-run-saved-plan").click();
    expect(prompted).toBe(true);
    await expect(page).toHaveURL(/\/plan$/);
    expect(await snapshot(page)).toEqual(before);
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
  });
}

test("accepting replacement keeps completed history and does not log unfinished time", async ({ page }) => {
  await seed(page, [plan], true);
  page.once("dialog", dialog => dialog.accept());
  await page.getByTestId("button-run-saved-plan").click();
  await assertHandoff(page);
});

test("a second tab cannot apply draft or saved plans until the owner closes", async ({ page, context }) => {
  await seed(page);
  const before = await snapshot(page);
  const second = await context.newPage();
  await second.goto("/plan");
  await expect(second.getByTestId("timer-status")).toContainText("read-only");
  await build(second);
  await expect(second.getByTestId("button-run-plan")).toBeDisabled();
  await expect(second.getByTestId("button-run-saved-plan")).toBeDisabled();
  expect(await snapshot(second)).toEqual(before);
  await page.close();
  await expect(second.getByTestId("button-run-saved-plan")).toBeEnabled();
  await second.getByTestId("button-run-saved-plan").click();
  await assertHandoff(second);
});

for (const source of ["draft", "saved"] as const) {
  test(`blocked timer write prevents ${source} navigation and preserves existing history`, async ({ page }) => {
    await seed(page, [plan], true);
    if (source === "draft") await build(page);
    const before = await snapshot(page);
    // Inject failure only at the browser storage boundary; use the real provider and navigation.
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException("Storage full", "QuotaExceededError");
        return original.call(this, name, value);
      };
    }, keys.timer);
    page.once("dialog", dialog => dialog.accept());
    await page.getByTestId(source === "draft" ? "button-run-plan" : "button-run-saved-plan").click();
    await expect(page.getByTestId("timer-status")).toContainText("Could not read or save this timer");
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByTestId("button-run-saved-plan")).toBeDisabled();
    expect(await snapshot(page)).toEqual(before);
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
  });
}

test("blocked timer reads disable handoff without overwriting stored data", async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  await page.addInitScript(key => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException("Storage blocked", "SecurityError");
      return original.call(this, name);
    };
  }, keys.timer);
  await page.reload();
  await expect(page.getByTestId("timer-status")).toContainText("Could not read or save this timer");
  await expect(page.getByTestId("button-run-saved-plan")).toBeDisabled();
  // A clean same-origin page can inspect the untouched data without the injected read failure.
  const inspector = await page.context().newPage();
  await inspector.goto("/plan");
  expect(await snapshot(inspector)).toEqual(before);
});
