import { expect, test, type Page } from "@playwright/test";

const key = "tau.plans.v1";
const saved = {
  id: "original", name: "Original plan", task: "Recall cells", duration: 30,
  ai: "No AI this session", method: "Pomodoro blocks", breakStyle: "Walk",
  notes: "Original notes", createdAt: 1794000000000,
};

async function stored(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), key);
}

async function quota(page: Page, blocked: boolean) {
  await page.evaluate(({ key, blocked }) => {
    const w = window as typeof window & { restoreStorage?: () => void };
    w.restoreStorage?.();
    if (blocked) {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, value) {
        if (k === key) throw new DOMException("Storage full", "QuotaExceededError");
        original.call(this, k, value);
      };
      w.restoreStorage = () => { Storage.prototype.setItem = original; };
    }
  }, { key, blocked });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/plan");
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify([saved])), { key, saved });
  await page.reload();
});

for (const action of ["create", "update"] as const) {
  test(`${action} quota failure preserves inputs and records; retry persists`, async ({ page }) => {
    const before = await stored(page);
    if (action === "update") {
      await page.getByTestId("button-edit-original").click();
    } else {
      await page.getByRole("button", { name: "Pomodoro blocks", exact: true }).click();
      await page.getByRole("button", { name: "Walk", exact: true }).click();
      await page.getByTestId("button-generate-plan").click();
    }
    await page.getByTestId("input-plan-name").fill("Recoverable plan");
    await page.getByTestId("input-plan-task").fill("Practice recall");
    await page.getByTestId("input-plan-notes").fill("Keep these notes");
    await page.getByTestId("input-plan-focus-minutes").fill("90");
    await page.getByTestId("input-plan-break-minutes").fill("15");
    await quota(page, true);
    await page.getByTestId("button-save-plan").click();
    await expect(page.getByTestId("plan-save-error")).toContainText("Could not save");
    await expect(page.getByText(/Plan (saved|updated)$/, { exact: true })).toHaveCount(0);
    expect(await stored(page)).toBe(before);
    await expect(page.getByTestId("card-plan-original")).toContainText(saved.name);
    await expect(page.getByTestId("input-plan-name")).toHaveValue("Recoverable plan");
    await expect(page.getByTestId("input-plan-task")).toHaveValue("Practice recall");
    await expect(page.getByTestId("input-plan-notes")).toHaveValue("Keep these notes");
    await expect(page.getByTestId("text-protocol")).toContainText("Focus 90 min / Break 15 min");
    await expect(page.getByTestId("button-copy-plan")).toBeEnabled();
    await expect(page.getByTestId("button-save-plan")).toHaveText(action === "update" ? "Update plan" : "Save plan");
    await quota(page, false);
    await page.getByTestId("button-save-plan").click();
    await expect(page.getByTestId("plan-save-error")).toHaveCount(0);
    const records = JSON.parse((await stored(page))!);
    expect(records).toHaveLength(action === "update" ? 1 : 2);
    expect(records[0]).toMatchObject({ name: "Recoverable plan", task: "Practice recall", notes: "Keep these notes", duration: 90, breakMinutes: 15 });
    await page.reload();
    await expect(page.locator('[data-testid^="card-plan-"]')).toHaveCount(records.length);
    await expect(page.getByText("Recoverable plan", { exact: true })).toBeVisible();
  });
}

test("delete cancellation and quota failure retain records after reload; retry deletes", async ({ page }) => {
  const before = await stored(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("button-delete-original").click();
  expect(await stored(page)).toBe(before);
  await quota(page, true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("button-delete-original").click();
  await expect(page.getByTestId("plan-delete-error")).toContainText("Could not delete");
  await expect(page.getByText("Plan deleted", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("card-plan-original")).toBeVisible();
  expect(await stored(page)).toBe(before);
  await page.reload();
  await expect(page.getByTestId("card-plan-original")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("button-delete-original").click();
  await expect(page.getByTestId("card-plan-original")).toHaveCount(0);
  expect(JSON.parse((await stored(page))!)).toEqual([]);
  await page.reload();
  await expect(page.getByTestId("card-plan-original")).toHaveCount(0);
});

test("failed update can be cancelled without changing the saved plan", async ({ page }) => {
  const before = await stored(page);
  await page.getByTestId("button-edit-original").click();
  await page.getByTestId("input-plan-notes").fill("Unsaved change");
  await quota(page, true);
  await page.getByTestId("button-save-plan").click();
  await expect(page.getByTestId("plan-save-error")).toBeVisible();
  await page.getByTestId("button-cancel-edit").click();
  await expect(page.getByTestId("plan-save-error")).toHaveCount(0);
  expect(await stored(page)).toBe(before);
  await page.reload();
  await page.getByTestId("button-edit-original").click();
  await expect(page.getByTestId("input-plan-notes")).toHaveValue(saved.notes);
});
