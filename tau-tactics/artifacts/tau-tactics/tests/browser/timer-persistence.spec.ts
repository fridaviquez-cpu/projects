import { expect, test, type Page } from "@playwright/test";

const keys = { timer: "tau.timer.v1", sessions: "tau.sessions.v1" };
const initialTime = new Date("2026-11-04T12:00:00Z");
const minute = 60_000;
const absence = 24 * 60 * minute;
const idleTimer = {
  version: 2, runId: "persistence-run", duration: 1,
  phases: [
    { kind: "focus", minutes: 1 }, { kind: "break", minutes: 1 },
    { kind: "focus", minutes: 1 }, { kind: "break", minutes: 1 },
  ],
  index: 0, status: "idle", endAt: null, remainingMs: minute,
  task: "Recall cell division", subject: "Biology", intention: "Study",
};

async function stored(page: Page) {
  return page.evaluate(keys => ({
    timer: JSON.parse(localStorage.getItem(keys.timer)!),
    sessions: JSON.parse(localStorage.getItem(keys.sessions)!),
  }), keys);
}

async function startBlock(page: Page) {
  // Freeze before loading React; no real-time sleeps or shortened provider intervals.
  await page.clock.install({ time: initialTime });
  await page.clock.pauseAt(initialTime);
  await page.goto("/focus");
  await page.evaluate(({ keys, idleTimer }) => {
    localStorage.clear();
    localStorage.setItem(keys.timer, JSON.stringify(idleTimer));
    localStorage.setItem(keys.sessions, "[]");
  }, { keys, idleTimer });
  await page.reload();
  await expect(page.getByTestId("timer-status")).toContainText("Focus 1 ready");
  await expect(page.getByTestId("button-start")).toBeEnabled();
  await page.getByTestId("button-start").click();
  await expect(page.getByTestId("timer-status")).toContainText("Focus 1 started");
  const { timer } = await stored(page);
  expect(timer).toMatchObject({ index: 0, status: "running" });
  return {
    id: `${timer.runId}-0`, task: idleTimer.task, subject: idleTimer.subject,
    intention: idleTimer.intention, minutes: 1, completedAt: timer.endAt,
  };
}

async function assertHistory(page: Page, entries: object[]) {
  await expect.poll(async () => (await stored(page)).sessions).toEqual(entries);
  await expect(page.getByTestId("section-history").locator('[data-testid^="row-log-"]'))
    .toHaveCount(entries.length);
  await expect(page.getByTestId("text-total-minutes")).toHaveText(`${entries.length}m`);
  for (const entry of entries as { id: string; task: string; subject: string }[]) {
    const row = page.getByTestId(`row-log-${entry.id}`);
    await expect(row).toContainText(entry.task);
    await expect(row).toContainText(entry.subject);
  }
}

async function assertReady(page: Page) {
  await expect(page.getByTestId("timer-status")).toContainText("Break finished. Start next block");
  await expect(page.getByTestId("button-start")).toBeEnabled();
  await expect(page.getByTestId("button-start")).toHaveText("Start next block");
  await expect(page.getByTestId("text-clock")).toHaveText("01:00");
  expect((await stored(page)).timer).toMatchObject({
    index: 2, status: "ready", endAt: null, remainingMs: minute,
  });
}

test("completed focus survives reload during break exactly once", async ({ page }) => {
  const completion = await startBlock(page);
  await page.clock.runFor(minute);
  await expect(page.getByTestId("timer-status")).toContainText("Break started");
  await assertHistory(page, [completion]);
  await page.clock.runFor(10_000);
  await page.reload();
  await expect(page.getByTestId("timer-status")).toContainText("Break started");
  await expect(page.getByTestId("text-clock")).toHaveText("00:50");
  expect((await stored(page)).timer).toMatchObject({
    index: 1, status: "running", endAt: completion.completedAt + minute,
  });
  await assertHistory(page, [completion]);

  // Simulate a suspended browser: elapsed time jumps, intervals run only once.
  await page.clock.fastForward(absence);
  await assertReady(page);
  await page.reload();
  await assertReady(page);
  await page.clock.fastForward(absence);
  await assertHistory(page, [completion]);
  await assertReady(page);

  // A later block is recorded only after the student explicitly starts it.
  await page.getByTestId("button-start").click();
  const secondEnd = (await stored(page)).timer.endAt;
  await page.clock.runFor(minute);
  const second = { ...completion, id: `${idleTimer.runId}-2`, completedAt: secondEnd };
  await assertHistory(page, [second, completion]);
  await page.reload();
  await assertHistory(page, [second, completion]);
});

test("reload after a long absence settles only the explicitly started focus", async ({ page }) => {
  const completion = await startBlock(page);
  // Move wall time without delivering ticks, as if the page was closed.
  await page.clock.setSystemTime(completion.completedAt + absence);
  await page.reload();
  await assertReady(page);
  await assertHistory(page, [completion]);
  await page.clock.fastForward(absence);
  await page.reload();
  await assertReady(page);
  await assertHistory(page, [completion]);
});

for (const failedKey of ["sessions", "timer"] as const) {
  test(`failed ${failedKey} write recovers on reload without missing or duplicate history`, async ({ page }) => {
    const completion = await startBlock(page);
    const before = await stored(page);
    // Fail only this write boundary. All reads and other writes use real storage.
    // Reload removes the injection, modelling storage becoming writable again.
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (this === localStorage && name === key) {
          throw new DOMException("Storage full", "QuotaExceededError");
        }
        return original.call(this, name, value);
      };
    }, keys[failedKey]);
    await page.clock.runFor(minute);
    await expect(page.getByTestId("timer-status")).toContainText("Could not read or save this timer");
    await expect(page.getByTestId("button-pause")).toBeDisabled();
    await expect(page.getByTestId("button-reset")).toBeDisabled();
    expect((await stored(page)).timer).toEqual(before.timer);
    // A failed history write must not appear saved. A successful history write
    // followed by a failed timer commit must survive replay with the same ID.
    await assertHistory(page, failedKey === "sessions" ? [] : [completion]);
    await page.clock.runFor(1_000);
    expect((await stored(page)).timer).toEqual(before.timer);

    await page.reload();
    await expect(page.getByTestId("timer-status")).toContainText("Break started");
    await expect(page.getByTestId("button-pause")).toBeEnabled();
    await assertHistory(page, [completion]);
    await page.reload();
    await assertHistory(page, [completion]);
    await page.clock.fastForward(absence);
    await assertReady(page);
    await page.reload();
    await assertReady(page);
    await assertHistory(page, [completion]);
  });
}
