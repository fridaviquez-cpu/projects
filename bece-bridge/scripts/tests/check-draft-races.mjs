import assert from "node:assert/strict";

const course = "210";
const draftKey = `bridge-check-draft-v1:${course}`;
const answerSelector = '[data-testid^="input-answer-"]';

async function waitForStart(page) {
  const button = page.getByTestId("button-start-diagnostic");
  await button.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => {
    const current = document.querySelector('[data-testid="button-start-diagnostic"]');
    return current && !current.disabled;
  }, null, { timeout: 15000 });
}

async function waitForQuestions(page) {
  await page.locator(answerSelector).nth(2).waitFor({ state: "visible", timeout: 15000 });
}

async function holdResponse(page, url, method) {
  let release;
  let ready;
  let resolveReady;
  const gate = new Promise((resolve) => { release = resolve; });
  ready = new Promise((resolve) => { resolveReady = resolve; });
  let captured;
  const handler = async (route) => {
    if (route.request().method() !== method) return route.continue();
    const upstream = await route.fetch();
    captured = { status: upstream.status() };
    if (upstream.status() !== 204) captured.json = await upstream.json();
    resolveReady(captured);
    await gate;
    if (captured.status === 204) {
      await route.fulfill({ status: 204, body: "" });
    } else {
      await route.fulfill({ status: captured.status, json: captured.json });
    }
  };
  await page.route(url, handler);
  return {
    ready,
    release,
    remove: () => page.unroute(url, handler),
  };
}

async function storedDraft(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), draftKey);
  assert.ok(raw, "Expected an unfinished draft in localStorage");
  return JSON.parse(raw);
}

async function assertRecoveryChoice(page, expectedId, expectedAnswer) {
  await page.getByTestId("button-resume").waitFor({ state: "visible", timeout: 10000 });
  const draft = await storedDraft(page);
  assert.equal(draft.id, expectedId);
  assert.equal(Object.values(draft.answers).includes(expectedAnswer), true);
  assert.equal(await page.locator(answerSelector).count(), 0, "Recovery choice must hide questions");
  assert.equal(await page.getByTestId("button-start-diagnostic").isDisabled(), true);
}

/**
 * Run the three ECE 210 cross-tab draft races in an already-created Playwright
 * BrowserContext. Initialize the anonymous guest session by opening /learn first.
 *
 * Example from a Playwright harness:
 *   await runCheckDraftRaces({ context, baseURL: process.env.BASE_URL });
 */
export async function runCheckDraftRaces({ context, baseURL }) {
  assert.ok(context, "Pass an initialized Playwright BrowserContext");
  assert.ok(baseURL, "Pass the application baseURL");
  const url = new URL("/learn?course=210", baseURL).href;
  const a = await context.newPage();
  const b = await context.newPage();
  const results = {};

  try {
    await Promise.all([a.goto(url), b.goto(url)]);
    // Use normal UI navigation first so anonymous guest-session state is initialized.
    await Promise.all([
      a.evaluate((key) => localStorage.removeItem(key), draftKey),
      b.evaluate((key) => localStorage.removeItem(key), draftKey),
    ]);
    await Promise.all([a.reload(), b.reload()]);
    await Promise.all([waitForStart(a), waitForStart(b)]);

    // Race 1: A's server creates a check, but B wins the local draft slot.
    const start = await holdResponse(a, "**/api/bridge/assessment", "POST");
    await a.getByTestId("button-start-diagnostic").click();
    const startedA = await start.ready;
    assert.equal(startedA.status, 200);
    await b.getByTestId("button-start-diagnostic").click();
    await waitForQuestions(b);
    await b.locator(answerSelector).nth(0).fill("56");
    const draftB1 = await storedDraft(b);
    assert.notEqual(draftB1.id, startedA.json.id);
    start.release();
    await assertRecoveryChoice(a, draftB1.id, "56");
    assert.equal((await storedDraft(b)).id, draftB1.id);
    results.start = { losingId: startedA.json.id, keptId: draftB1.id, keptAnswer: "56" };
    await start.remove();

    // Race 2: A's submit commits, then B replaces the local draft before A clears.
    await a.getByTestId("button-resume").click();
    await waitForQuestions(a);
    await a.locator(answerSelector).nth(1).fill("20");
    await a.locator(answerSelector).nth(2).fill("150");
    const submit = await holdResponse(a, "**/api/bridge/assessment/submit", "POST");
    await a.getByTestId("button-submit").click();
    const submitted = await submit.ready;
    assert.equal(submitted.status, 200);
    assert.equal(submitted.json.id, draftB1.id);
    await b.evaluate((key) => localStorage.removeItem(key), draftKey);
    await b.reload();
    await waitForStart(b);
    await b.getByTestId("button-start-diagnostic").click();
    await waitForQuestions(b);
    await b.locator(answerSelector).nth(0).fill("77");
    const draftB2 = await storedDraft(b);
    assert.notEqual(draftB2.id, draftB1.id);
    submit.release();
    await assertRecoveryChoice(a, draftB2.id, "77");
    assert.equal((await storedDraft(b)).id, draftB2.id);
    results.submit = { completedId: submitted.json.id, keptId: draftB2.id, keptAnswer: "77" };
    await submit.remove();

    // Race 3: A's discard commits, then B replaces the local draft before A clears.
    await a.getByTestId("button-resume").click();
    await waitForQuestions(a);
    const discard = await holdResponse(a, "**/api/bridge/assessment/**", "DELETE");
    await a.getByTestId("button-discard").click();
    const discarded = await discard.ready;
    assert.equal(discarded.status, 204);
    await b.evaluate((key) => localStorage.removeItem(key), draftKey);
    await b.reload();
    await waitForStart(b);
    await b.getByTestId("button-start-diagnostic").click();
    await waitForQuestions(b);
    await b.locator(answerSelector).nth(0).fill("88");
    const draftB3 = await storedDraft(b);
    assert.notEqual(draftB3.id, draftB2.id);
    discard.release();
    await assertRecoveryChoice(a, draftB3.id, "88");
    assert.equal((await storedDraft(b)).id, draftB3.id);
    results.discard = { discardedId: draftB2.id, keptId: draftB3.id, keptAnswer: "88" };
    await discard.remove();

    // Leave the guest browser clean after verifying the race outcome.
    await b.getByTestId("button-discard").click();
    await b.waitForFunction((key) => localStorage.getItem(key) === null, draftKey, { timeout: 10000 });
    return results;
  } finally {
    await Promise.all([a.close().catch(() => {}), b.close().catch(() => {})]);
  }
}
