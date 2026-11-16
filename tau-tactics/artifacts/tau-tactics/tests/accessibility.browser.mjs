// Run against an isolated browser context; never touches the student's storage.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chrome node tests/accessibility.browser.mjs
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const base = process.env.TEST_BASE_URL || "http://localhost:80";
try {
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.setItem("tau.sessions.v1", JSON.stringify([{
      id: "a11y", task: "Practice a long topic without clipping controls", minutes: 25,
      completedAt: Date.now(), reflection: { recalled: true, practiced: true, takeaway: "Example" },
    }]));
    localStorage.setItem("tau.plans.v1", JSON.stringify([{
      id: "a11y", name: "Sample plan", duration: 25, ai: "ChatGPT",
      method: "Active recall", breakStyle: "Walk", notes: "", createdAt: Date.now(),
    }]));
  });
  for (const width of [320, 640, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/focus", "/learn", "/ai", "/plan", "/toolkit"]) {
      await page.goto(base + route);
      await page.waitForTimeout(600);
      const result = await page.evaluate(() => {
        // Canvas resolves modern CSS color()/oklab() as well as rgb().
        const ctx = document.createElement("canvas").getContext("2d");
        function rgba(color) {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b, a / 255];
        }
        const blend = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
        const luminance = (rgb) => rgb.map(v => {
          v /= 255;
          return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
        }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          targets: [...document.querySelectorAll(".icon-action")].map(e => {
            const r = e.getBoundingClientRect();
            return { id: e.dataset.testid, width: r.width, height: r.height };
          }),
          contrast: [...document.querySelectorAll(".text-gold")].filter(e => e.getBoundingClientRect().width).map(e => {
            const parents = [];
            for (let p = e; p; p = p.parentElement) parents.unshift(p);
            const bg = parents.reduce((b, p) => blend(rgba(getComputedStyle(p).backgroundColor), b), [255, 255, 255]);
            const fg = blend(rgba(getComputedStyle(e).color), bg);
            const a = luminance(fg), b = luminance(bg);
            return { text: e.textContent.slice(0, 35), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
          }),
        };
      });
      assert.equal(result.overflow, false, `${width} ${route} overflow`);
      for (const t of result.targets) assert(t.width >= 44 && t.height >= 44, JSON.stringify(t));
      for (const c of result.contrast) assert(c.ratio >= 4.5, JSON.stringify(c));
      const nav = page.locator(`[data-testid="link-${width < 768 ? "mobile" : "nav"}-my-plan"]`);
      assert.equal(await nav.innerText(), "My Plan");
      assert.equal(await nav.getAttribute("aria-current"), route === "/plan" ? "page" : null);
      console.log(width, route, JSON.stringify(result));
    }
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(base + "/toolkit");
  const bookmark = page.locator('[data-testid^="button-bookmark-"]').first();
  await bookmark.focus();
  assert(await bookmark.evaluate(e => e.matches(":focus-visible")));
  await page.keyboard.press("Space");
  assert.equal(await bookmark.getAttribute("aria-pressed"), "true");
  await page.keyboard.press("Enter");
  assert.equal(await bookmark.getAttribute("aria-pressed"), "false");
  await page.locator('[data-testid="link-mobile-my-plan"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/plan");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.testid), "link-mobile-toolkit");
  page.on("dialog", dialog => dialog.accept());
  for (const [route, id] of [["/focus", "button-delete-log-a11y"], ["/plan", "button-delete-a11y"]]) {
    await page.goto(base + route);
    const button = page.locator(`[data-testid="${id}"]`);
    await button.focus();
    assert(await button.evaluate(e => e.matches(":focus-visible")));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    assert.equal(await button.count(), 0);
  }
  // Model 1280x900 at 200% zoom with half the CSS viewport and doubled DPR.
  // CSS zoom alone does not update media queries, unlike browser zoom.
  const zoomContext = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });
  const zoomPage = await zoomContext.newPage();
  for (const route of ["/focus", "/plan", "/toolkit"]) {
    await zoomPage.goto(base + route);
    await zoomPage.waitForTimeout(600);
    assert(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await zoomContext.close();
  console.log("Keyboard, target sizes, contrast, narrow reflow and zoom-equivalent checks passed.");
} finally {
  await browser.close();
}
