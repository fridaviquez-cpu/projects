import { expect, test, type Page } from "@playwright/test";

const id = "review-regression";
const route = `/review/${id}`;
const key = `tau.review.v1:${id}`;
const draftKey = `tau.review-draft.v1:${id}`;
const sessions = [{
  id, task: "Recall cell division", subject: "Biology", intention: "Study",
  minutes: 25, completedAt: 1793990000000,
  reflection: { recalled: true, practiced: false, takeaway: "Cells divide", unclear: "How meiosis differs" },
}];
const review = {
  id, sessionId: id, topic: "How meiosis differs", date: "",
  createdAt: 1793990000000, updatedAt: 1793990000000, revision: "original",
  attempt: "My saved explanation", feedbackUnlocked: true,
};

async function seed(page: Page, unlocked = true) {
  await page.goto("/");
  await page.evaluate(({ sessions, review, key, unlocked }) => {
    localStorage.setItem("tau.sessions.v1", JSON.stringify(sessions));
    localStorage.setItem(key, JSON.stringify({
      ...review, attempt: unlocked ? review.attempt : "", feedbackUnlocked: unlocked,
    }));
  }, { sessions, review, key, unlocked });
  await page.goto(route);
}

async function saved(page: Page) {
  return page.evaluate(key => localStorage.getItem(key), key);
}

// Reversible, tab-local faults: never clear storage or touch non-review writes.
async function blockReviewStorage(page: Page, mode: "writes" | "access") {
  await page.evaluate(mode => {
    const storage = window.localStorage;
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    if (mode === "access") {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() { throw new DOMException("Blocked", "SecurityError"); },
      });
    } else {
      Storage.prototype.setItem = function (key, value) {
        if (this === storage && key.startsWith("tau.review.v1:")) throw new DOMException("Full", "QuotaExceededError");
        return set.call(this, key, value);
      };
      Storage.prototype.removeItem = function (key) {
        if (this === storage && key.startsWith("tau.review.v1:")) throw new DOMException("Blocked", "SecurityError");
        return remove.call(this, key);
      };
    }
    Object.assign(window, {
      reviewStorageSnapshot: () => ({
        review: storage.getItem("tau.review.v1:review-regression"),
        sessions: storage.getItem("tau.sessions.v1"),
      }),
      restoreReviewStorage: () => {
        Object.defineProperty(window, "localStorage", descriptor);
        Storage.prototype.setItem = set;
        Storage.prototype.removeItem = remove;
      },
    });
  }, mode);
}

async function restoreReviewStorage(page: Page) {
  await page.evaluate(() => (window as unknown as { restoreReviewStorage: () => void }).restoreReviewStorage());
}

async function storageSnapshot(page: Page) {
  return page.evaluate(() => (window as unknown as {
    reviewStorageSnapshot: () => { review: string | null; sessions: string | null };
  }).reviewStorageSnapshot());
}

async function prompt(page: Page, text: string) {
  await page.getByTestId("toggle-ai-prompt").click();
  await page.getByTestId("input-prompt").fill(text);
  await expect.poll(() => page.evaluate(k => JSON.parse(sessionStorage.getItem(k) ?? "null")?.prompt, draftKey)).toBe(text);
}

test.beforeEach(async ({ page }) => {
  // Fresh Playwright contexts isolate every test. Only intentional sibling tabs share data.
  page.on("dialog", dialog => dialog.accept());
});

test("attempt draft survives reload, remains tab-local, and saves only explicitly", async ({ page, context }) => {
  await seed(page, false);
  const original = await saved(page);
  await page.getByTestId("input-attempt").fill("Unfinished recall in tab A");
  await expect.poll(() => page.evaluate(k => JSON.parse(sessionStorage.getItem(k) ?? "null")?.attempt, draftKey)).toBe("Unfinished recall in tab A");
  const second = await context.newPage();
  await second.goto(route);
  await expect(second.getByTestId("input-attempt")).toHaveValue("");
  await second.getByTestId("input-attempt").fill("Separate recall in tab B");
  await page.reload();
  await expect(page.getByTestId("input-attempt")).toHaveValue("Unfinished recall in tab A");
  expect(await saved(page)).toBe(original);
  await page.getByTestId("button-save-attempt").click();
  await expect(page.getByTestId("text-saved-attempt")).toHaveText("Unfinished recall in tab A");
  await page.reload();
  await expect(page.getByTestId("text-saved-attempt")).toHaveText("Unfinished recall in tab A");
  expect(await page.evaluate(k => sessionStorage.getItem(k), draftKey)).toBeNull();
});

test("prompt draft recovers through navigation and reload without replacing saved attempt", async ({ page }) => {
  await seed(page);
  const original = await saved(page);
  await prompt(page, "My private feedback draft");
  await page.goto("/");
  await page.getByTestId(`link-review-${id}`).click();
  await page.getByTestId("toggle-ai-prompt").click();
  await expect(page.getByTestId("input-prompt")).toHaveValue("My private feedback draft");
  await page.reload();
  await page.getByTestId("toggle-ai-prompt").click();
  await expect(page.getByTestId("input-prompt")).toHaveValue("My private feedback draft");
  expect(await saved(page)).toBe(original);
  await page.getByTestId("button-save-prompt").click();
  await expect.poll(async () => JSON.parse((await saved(page))!).promptDraft).toBe("My private feedback draft");
  expect(JSON.parse((await saved(page))!).attempt).toBe(review.attempt);
});

for (const fallback of ["false", "throws"] as const) {
  test(`blocked clipboard with ${fallback} fallback keeps the complete prompt selectable and retries`, async ({ page }) => {
    await seed(page);
    const original = await saved(page);
    const source = await page.evaluate(() => localStorage.getItem("tau.sessions.v1"));
    await page.getByTestId("toggle-ai-prompt").click();
    const preview = page.getByTestId("input-prompt");
    const completePrompt = await preview.inputValue();
    expect(completePrompt).toContain(review.topic);
    expect(completePrompt).toContain(review.attempt);

    // Fault both browser copy paths, not the React handler. Recovery uses a
    // controlled clipboard sink so this case needs no OS clipboard permissions.
    await page.evaluate(fallback => {
      let blocked = true;
      const writes: string[] = [];
      const attempts: string[] = [];
      let legacyCalls = 0;
      const execCommand = document.execCommand.bind(document);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          async writeText(text: string) {
            attempts.push(text);
            if (blocked) throw new DOMException("Clipboard denied", "NotAllowedError");
            writes.push(text);
          },
        },
      });
      document.execCommand = (command, ...args) => {
        if (command !== "copy") return execCommand(command, ...args);
        legacyCalls++;
        if (fallback === "throws") throw new DOMException("Copy denied", "NotAllowedError");
        return false;
      };
      Object.assign(window, {
        allowReviewClipboard: () => { blocked = false; },
        reviewClipboardSnapshot: () => ({ attempts, writes, legacyCalls }),
      });
    }, fallback);

    const copy = page.getByTestId("button-copy-prompt");
    await copy.click();
    await expect(page.getByTestId("alert-copy")).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("alert-copy")).toHaveText("Couldn't copy automatically. Select the prompt text above and copy it manually.");
    await expect(copy).toHaveText("Copy prompt");
    await expect(page.getByRole("status").filter({ hasText: "Copy failed." })).toContainText("copy it manually");
    await expect(preview).toHaveValue(completePrompt);
    await preview.focus();
    await preview.press("ControlOrMeta+a");
    expect(await preview.evaluate((element: HTMLTextAreaElement) =>
      element.value.slice(element.selectionStart, element.selectionEnd))).toBe(completePrompt);
    await expect(page.getByTestId("text-saved-attempt")).toHaveText(review.attempt);
    expect(await saved(page)).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem("tau.sessions.v1"))).toBe(source);

    const clipboardSnapshot = () => page.evaluate(() => (window as unknown as {
      reviewClipboardSnapshot: () => { attempts: string[]; writes: string[]; legacyCalls: number };
    }).reviewClipboardSnapshot());
    expect(await clipboardSnapshot()).toEqual({ attempts: [completePrompt], writes: [], legacyCalls: 1 });
    await page.evaluate(() => (window as unknown as { allowReviewClipboard: () => void }).allowReviewClipboard());
    await copy.click();
    await expect(copy).toHaveText("Copied");
    await expect(page.getByTestId("alert-copy")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Prompt copied." })).toHaveText("Prompt copied.");
    expect(await clipboardSnapshot()).toEqual({
      attempts: [completePrompt, completePrompt], writes: [completePrompt], legacyCalls: 1,
    });
    await expect(preview).toHaveValue(completePrompt);
    await expect(page.getByTestId("text-saved-attempt")).toHaveText(review.attempt);
    expect(await saved(page)).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem("tau.sessions.v1"))).toBe(source);
  });
}

test("stale tab cannot overwrite a newer revision, even after draft recovery", async ({ page, context }) => {
  await seed(page);
  const second = await context.newPage();
  second.on("dialog", dialog => dialog.accept());
  await second.goto(route);
  await prompt(second, "Losing tab draft");
  await prompt(page, "Winning saved prompt");
  await page.getByTestId("button-save-prompt").click();
  await expect(second.getByTestId("alert-review-conflict")).toBeVisible();
  const winner = await saved(page);
  await second.reload();
  await second.getByTestId("toggle-ai-prompt").click();
  await expect(second.getByTestId("input-prompt")).toHaveValue("Losing tab draft");
  await second.getByTestId("button-save-prompt").click();
  await expect(second.getByTestId("alert-prompt")).toContainText("changed in another tab");
  expect(await saved(second)).toBe(winner);
  expect(JSON.parse(winner!).attempt).toBe(review.attempt);
  await second.getByTestId("button-reload-review").click();
  await second.getByTestId("toggle-ai-prompt").click();
  await expect(second.getByTestId("input-prompt")).toHaveValue("Winning saved prompt");
  await expect(second.getByTestId("alert-review-conflict")).toHaveCount(0);
});

test("deletion in a sibling tab is observed without resurrecting a review", async ({ page, context }) => {
  await seed(page);
  const second = await context.newPage();
  await second.goto(route);
  await prompt(second, "Draft held while deleted");
  await page.getByTestId("button-delete-review").click();
  await page.getByTestId("button-confirm-delete").click();
  await expect(second.getByTestId("empty-review-missing")).toBeVisible();
  await expect(second.getByTestId("text-orphaned-draft")).toHaveValue(/Draft held while deleted/);
  await expect(second.getByTestId("text-orphaned-draft")).toHaveAttribute("readonly", "");
  expect(await saved(second)).toBeNull();
  // Deletion must not silently erase the tab's recovery copy or source reflection.
  expect(await second.evaluate(k => JSON.parse(sessionStorage.getItem(k)!).prompt, draftKey)).toBe("Draft held while deleted");
  await second.reload();
  await expect(second.getByTestId("empty-review-missing")).toBeVisible();
  const recovery = second.getByTestId("text-orphaned-draft");
  await expect(recovery).toHaveValue(/Draft held while deleted/);
  await expect(second.getByTestId("button-save-prompt")).toHaveCount(0);
  // Deterministically verify the exact clipboard payload without browser permissions.
  await second.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text: string) => { (window as any).__copiedDraft = text; },
    } });
  });
  await second.getByTestId("button-copy-orphaned-draft").click();
  await expect(second.getByRole("status").filter({ hasText: "Draft copied." })).toBeVisible();
  expect(await second.evaluate(() => (window as any).__copiedDraft)).toBe(await recovery.inputValue());
  // Clipboard failure still leaves a selectable manual copy.
  await second.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new Error("Blocked"); },
    } });
    document.execCommand = () => false;
  });
  await second.getByTestId("button-copy-orphaned-draft").click();
  await expect(second.getByRole("status").filter({ hasText: "Select the draft text" })).toBeVisible();
  await expect(recovery).toHaveValue(/Draft held while deleted/);
  await second.getByTestId("button-discard-orphaned-draft").click();
  await second.getByTestId("button-keep-draft").click();
  await expect(recovery).toBeVisible();
  await second.getByTestId("button-discard-orphaned-draft").click();
  await second.getByTestId("button-confirm-discard-draft").click();
  await expect(recovery).toHaveCount(0);
  expect(await second.evaluate(k => sessionStorage.getItem(k), draftKey)).toBeNull();
  await second.reload();
  await expect(recovery).toHaveCount(0);
  expect(await saved(second)).toBeNull();
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem("tau.sessions.v1")!))).toEqual(sessions);
});

for (const mode of ["writes", "access"] as const) {
  test(`blocked sessionStorage ${mode} warns honestly and leaves saved work intact`, async ({ page }) => {
    await seed(page, false);
    const original = await saved(page);
    await page.addInitScript(mode => {
      if (mode === "access") {
        Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
      } else {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === window.sessionStorage) throw new DOMException("Full", "QuotaExceededError");
          return set.call(this, key, value);
        };
      }
    }, mode);
    await page.reload();
    await page.getByTestId("input-attempt").fill("Keep a manual copy");
    await expect(page.getByText("Draft could not be stored for reload.")).toBeVisible();
    expect(await saved(page)).toBe(original);
    // In-memory recovery works across SPA navigation, but is not promised after reload.
    await page.getByRole("link", { name: "Today", exact: true }).first().click();
    await page.getByTestId(`link-review-${id}`).click();
    await expect(page.getByTestId("input-attempt")).toHaveValue("Keep a manual copy");
    await page.reload();
    await expect(page.getByTestId("input-attempt")).toHaveValue("");
    expect(await saved(page)).toBe(original);
    await page.getByTestId("input-attempt").fill("Explicit save still works");
    await page.getByTestId("button-save-attempt").click();
    await expect(page.getByTestId("text-saved-attempt")).toHaveText("Explicit save still works");
  });
}

test("reflection creation synchronizes across tabs and reopening preserves the attempt", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(sessions => localStorage.setItem("tau.sessions.v1", JSON.stringify(sessions)), sessions);
  await page.goto("/focus");
  await page.getByTestId(`button-checkin-${id}`).click();
  await page.getByTestId("button-open-review-next").click();
  const second = await context.newPage();
  await second.goto("/focus");
  await second.getByTestId(`button-checkin-${id}`).click();
  await second.getByTestId("button-open-review-next").click();
  // The other tab correctly replaces Save with Open when storage/focus syncs.
  // Assert that user-visible behavior rather than racing a disappearing button.
  // Duplicate-create semantics are independently covered by reviews.test.mjs.
  await page.getByTestId("button-save-review-item").click();
  await expect(second.getByTestId("link-open-review")).toBeVisible();
  await expect(second.getByTestId("button-save-review-item")).toHaveCount(0);
  await page.getByTestId("link-open-review").click();
  await page.getByTestId("input-attempt").fill("Do not reset this attempt");
  await page.getByTestId("button-save-attempt").click();
  await expect(page.getByTestId("text-saved-attempt")).toHaveText("Do not reset this attempt");
  const before = await saved(page);
  await second.reload();
  await second.getByTestId(`button-checkin-${id}`).click();
  await expect(second.getByTestId("button-open-review-next")).toHaveCount(0);
  await second.getByTestId("link-open-review").click();
  await expect(second.getByTestId("text-saved-attempt")).toHaveText("Do not reset this attempt");
  expect(await saved(second)).toBe(before);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("tau.review.v1:")))).toEqual([key]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tau.sessions.v1")!))).toEqual(sessions);
});

test("reflection creation is idempotent across tabs and reopening preserves the attempt", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(sessions => localStorage.setItem("tau.sessions.v1", JSON.stringify(sessions)), sessions);
  await page.goto("/focus");
  await page.getByTestId(`button-checkin-${id}`).click();
  await page.getByTestId("button-open-review-next").click();
  const second = await context.newPage();
  await second.goto("/focus");
  await second.getByTestId(`button-checkin-${id}`).click();
  await second.getByTestId("button-open-review-next").click();
  // Hold the real write lock until both UI submissions are queued. Otherwise
  // one commit's storage event can unmount the other button before its click.
  await page.evaluate(() => new Promise<void>(resolve => {
    void navigator.locks.request("tau-reviews-write", () => new Promise<void>(release => {
      Object.assign(window, { releaseReviewTestLock: release });
      resolve();
    }));
  }));
  try {
    await Promise.all([
      page.getByTestId("button-save-review-item").click(),
      second.getByTestId("button-save-review-item").click(),
    ]);
    await expect(page.getByTestId("button-save-review-item")).toBeDisabled();
    await expect(second.getByTestId("button-save-review-item")).toBeDisabled();
  } finally {
    await page.evaluate(() => (window as unknown as { releaseReviewTestLock: () => void }).releaseReviewTestLock());
  }
  await page.getByTestId("link-open-review").click();
  await page.getByTestId("input-attempt").fill("Do not reset this attempt");
  await page.getByTestId("button-save-attempt").click();
  await expect(page.getByTestId("text-saved-attempt")).toHaveText("Do not reset this attempt");
  const before = await saved(page);
  await second.reload();
  await second.getByTestId(`button-checkin-${id}`).click();
  await expect(second.getByTestId("button-open-review-next")).toHaveCount(0);
  await second.getByTestId("link-open-review").click();
  await expect(second.getByTestId("text-saved-attempt")).toHaveText("Do not reset this attempt");
  expect(await saved(second)).toBe(before);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("tau.review.v1:")))).toEqual([key]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tau.sessions.v1")!))).toEqual(sessions);
});

for (const mode of ["writes", "access"] as const) {
  for (const field of ["attempt", "prompt"] as const) {
    test(`blocked localStorage ${mode}: ${field} stays recoverable and retries explicitly`, async ({ page }) => {
      await seed(page, field === "prompt");
      const original = await saved(page);
      const source = await page.evaluate(() => localStorage.getItem("tau.sessions.v1"));
      const text = `Unsaved ${field} during ${mode} failure`;
      if (field === "prompt") await prompt(page, text);
      else await page.getByTestId("input-attempt").fill(text);
      await blockReviewStorage(page, mode);
      await page.getByTestId(`button-save-${field}`).click();
      await expect(page.getByTestId(`alert-${field}`)).toContainText("Couldn't save:");
      await expect(page.getByTestId(`alert-${field}`)).toContainText("Your text is still here.");
      await expect(page.getByTestId(`input-${field}`)).toHaveValue(text);
      await expect(page.getByText(field === "prompt" ? "Prompt edits saved." : "Attempt saved. Check steps are now open.", { exact: true })).toHaveCount(0);
      expect(await storageSnapshot(page)).toEqual({ review: original, sessions: source });
      await expect.poll(() => page.evaluate(({ draftKey, field }) =>
        JSON.parse(sessionStorage.getItem(draftKey) ?? "null")?.[field], { draftKey, field })).toBe(text);
      await restoreReviewStorage(page);
      await page.getByTestId(`alert-${field}-retry`).click();
      await expect(page.getByTestId(`alert-${field}`)).toHaveCount(0);
      await expect.poll(async () => JSON.parse((await saved(page))!)[field === "prompt" ? "promptDraft" : "attempt"]).toBe(text);
      await page.reload();
      await expect(page.getByTestId("text-saved-attempt")).toHaveText(field === "prompt" ? review.attempt : text);
      if (field === "prompt") {
        await page.getByTestId("toggle-ai-prompt").click();
        await expect(page.getByTestId("input-prompt")).toHaveValue(text);
      }
      expect(await page.evaluate(() => localStorage.getItem("tau.sessions.v1"))).toBe(source);
    });
  }
}

test("failed prompt save survives reload without changing saved work", async ({ page }) => {
  await seed(page);
  const original = await saved(page);
  await prompt(page, "Recover this unsaved prompt after reload");
  await blockReviewStorage(page, "writes");
  await page.getByTestId("button-save-prompt").click();
  await expect(page.getByTestId("alert-prompt")).toBeVisible();
  expect(await saved(page)).toBe(original);
  // Reload removes the injected fault, but must not auto-commit the recovered draft.
  await page.reload();
  await page.getByTestId("toggle-ai-prompt").click();
  await expect(page.getByTestId("input-prompt")).toHaveValue("Recover this unsaved prompt after reload");
  expect(await saved(page)).toBe(original);
  await page.getByTestId("button-save-prompt").click();
  await expect.poll(async () => JSON.parse((await saved(page))!).promptDraft).toBe("Recover this unsaved prompt after reload");
  expect(JSON.parse((await saved(page))!).attempt).toBe(review.attempt);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tau.sessions.v1")!))).toEqual(sessions);
});

test("blocked deletion keeps saved attempt and draft until a successful retry", async ({ page }) => {
  await seed(page);
  await prompt(page, "Keep this draft while deletion fails");
  const original = await saved(page);
  await blockReviewStorage(page, "writes");
  await page.getByTestId("button-delete-review").click();
  await page.getByTestId("button-confirm-delete").click();
  await expect(page.getByTestId("alert-delete")).toContainText("Couldn't delete:");
  await expect(page.getByTestId("text-saved-attempt")).toHaveText(review.attempt);
  expect(await saved(page)).toBe(original);
  expect(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!).prompt, draftKey)).toBe("Keep this draft while deletion fails");
  await restoreReviewStorage(page);
  await page.getByTestId("alert-delete-retry").click();
  await expect(page.getByTestId("section-review-home")).toBeVisible();
  expect(await saved(page)).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tau.sessions.v1")!))).toEqual(sessions);
});

for (const view of ["home", "detail"] as const) {
  test(`${view} reports unavailable review storage and retries without losing saved data`, async ({ page }) => {
    await seed(page);
    const original = await saved(page);
    if (view === "home") await page.goto("/");
    await blockReviewStorage(page, "access");
    await page.evaluate(() => window.dispatchEvent(new Event("tau-reviews")));
    const error = page.getByTestId(view === "home" ? "text-review-home-error" : "alert-review-load");
    await expect(error).toContainText("Could not read reviews on this device.");
    expect(await storageSnapshot(page)).toEqual({ review: original, sessions: JSON.stringify(sessions) });
    await restoreReviewStorage(page);
    await page.getByTestId(view === "home" ? "button-retry-reviews" : "alert-review-load-retry").click();
    await expect(error).toHaveCount(0);
    if (view === "home") await page.getByTestId(`link-review-${id}`).click();
    await expect(page.getByTestId("text-saved-attempt")).toHaveText(review.attempt);
    expect(await saved(page)).toBe(original);
  });
}

const malformedReviews = [
  { name: "invalid JSON", raw: '{ "attempt": "keep original bytes", ' },
  { name: "invalid record shape", raw: JSON.stringify({ ...review, attempt: 42 }) },
  { name: "mismatched storage identity", raw: JSON.stringify({ ...review, id: "wrong-id", sessionId: "wrong-id" }) },
];

for (const { name, raw } of malformedReviews) {
  test(`${name} stays unchanged while a valid sibling remains usable`, async ({ page }) => {
    await seed(page);
    const siblingId = "valid-review-sibling";
    const siblingKey = `tau.review.v1:${siblingId}`;
    await page.evaluate(({ key, raw, siblingKey, siblingId, review }) => {
      localStorage.setItem(key, raw);
      localStorage.setItem(siblingKey, JSON.stringify({ ...review, id: siblingId, sessionId: siblingId }));
    }, { key, raw, siblingKey, siblingId, review });
    await page.goto("/");
    await expect(page.getByTestId("text-review-home-error")).toContainText("kept unchanged");
    await expect(page.getByTestId(`link-review-${id}`)).toHaveCount(0);
    await page.getByTestId("button-retry-reviews").click();
    await expect(page.getByTestId("text-review-home-error")).toBeVisible();
    expect(await saved(page)).toBe(raw);
    await page.getByTestId(`link-review-${siblingId}`).click();
    await expect(page.getByTestId("text-saved-attempt")).toHaveText(review.attempt);
    await page.getByTestId("toggle-ai-prompt").click();
    await page.getByTestId("input-prompt").fill("Valid sibling can still save");
    await page.getByTestId("button-save-prompt").click();
    await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).promptDraft, siblingKey)).toBe("Valid sibling can still save");
    await page.reload();
    await expect(page.getByTestId("text-saved-attempt")).toHaveText(review.attempt);
    await page.goto(route);
    await expect(page.getByTestId("alert-review-load")).toContainText("kept unchanged");
    await expect(page.getByTestId("input-attempt")).toHaveCount(0);
    await page.getByTestId("alert-review-load-retry").click();
    await expect(page.getByTestId("alert-review-load")).toBeVisible();
    expect(await saved(page)).toBe(raw);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tau.sessions.v1")!))).toEqual(sessions);
  });

  test(`${name} appearing during editing cannot be overwritten by a stale save`, async ({ page }) => {
    await seed(page);
    const original = await saved(page);
    await prompt(page, "Recoverable edits over unreadable data");
    // Same-tab external corruption deliberately emits no event, exercising the
    // mutation-time validation rather than only the hook's render-time reader.
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
    await page.getByTestId("button-save-prompt").click();
    await expect(page.getByTestId("alert-prompt")).toContainText("Couldn't save:");
    await expect(page.getByTestId("input-prompt")).toHaveValue("Recoverable edits over unreadable data");
    expect(await saved(page)).toBe(raw);
    expect(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!).prompt, draftKey)).toBe("Recoverable edits over unreadable data");
    // Simulate external restoration, not an app repair or automatic overwrite.
    await page.evaluate(({ key, original }) => localStorage.setItem(key, original!), { key, original });
    await page.getByTestId("alert-prompt-retry").click();
    await expect.poll(async () => JSON.parse((await saved(page))!).promptDraft).toBe("Recoverable edits over unreadable data");
    expect(JSON.parse((await saved(page))!).attempt).toBe(review.attempt);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tau.sessions.v1")!))).toEqual(sessions);
  });
}

for (const zone of [
  { timezoneId: "America/Los_Angeles", before: "2026-11-08T07:59:00Z", after: "2026-11-08T08:01:00Z" },
  { timezoneId: "Asia/Tokyo", before: "2026-11-07T14:59:00Z", after: "2026-11-07T15:01:00Z" },
]) {
  test.describe(zone.timezoneId, () => {
    test.use({ timezoneId: zone.timezoneId });
    test("local midnight controls date inputs and ready/later grouping, not UTC", async ({ page }) => {
      await page.clock.setFixedTime(new Date(zone.before));
      await seed(page);
      await page.getByTestId("radio-next-revisit").check();
      await expect(page.getByTestId("input-next-date")).toHaveAttribute("min", "2026-11-07");
      await page.getByTestId("input-next-date").fill("2026-11-08");
      await page.getByTestId("button-save-next").click();
      await expect.poll(async () => JSON.parse((await saved(page))!).date).toBe("2026-11-08");
      await page.goto("/");
      await expect(page.getByTestId("toggle-later-reviews")).toHaveText("Planned later (1)");
      await page.clock.setFixedTime(new Date(zone.after));
      await page.reload();
      await expect(page.getByTestId("toggle-later-reviews")).toHaveCount(0);
      await page.getByTestId(`link-review-${id}`).click();
      await expect(page.getByTestId("input-next-date")).toHaveAttribute("min", "2026-11-08");
      await expect(page.getByTestId("input-next-date")).toHaveValue("2026-11-08");
      await expect(page.getByTestId("text-saved-attempt")).toHaveText(review.attempt);
    });
  });
}
