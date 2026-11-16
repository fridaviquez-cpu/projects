import { test, expect } from "@playwright/test";
import { arithmetic, units, physicalDisclaimer, unitDisclaimer, hostileHtml, literalMath, nestedLiteralMath } from "./tutor-markdown.fixtures";
import { unsafeDestinations, safeSource, safeImage } from "./unsafe-destinations.fixtures";
import { supportedLinks, undefinedReferences } from "./supported-destinations.fixtures";
import { supportedImages } from "./supported-images.fixtures";

test("saved reference images load initially and after reload", { tag: "@destinations" }, async ({ page, context }) => {
  const fixtureUrl = "http://127.0.0.1:5199/tests/tutor-markdown.html?supported-images";
  const expectedUrls = supportedImages.map(image => new URL(image.src, fixtureUrl).href);
  const imageRequests: string[] = [];
  const unexpectedRequests: string[] = [];
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (expectedUrls.includes(url.href)) {
      imageRequests.push(url.href);
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"><rect width="8" height="6" fill="blue"/></svg>',
      });
    }
    if (url.origin === "https://fonts.googleapis.com" && request.resourceType() === "stylesheet") {
      return route.fulfill({ contentType: "text/css", body: "" });
    }
    // Unknown images are blocked even when same-origin. Only fixture assets
    // may use the local server; no external request reaches the network.
    if (url.origin === new URL(fixtureUrl).origin && request.resourceType() !== "image" &&
        (!request.isNavigationRequest() || url.href === fixtureUrl)) {
      return route.continue();
    }
    unexpectedRequests.push(url.href);
    return route.abort();
  });

  for (const reopen of [false, true]) {
    const requestsBeforeRender = imageRequests.length;
    if (reopen) await page.reload();
    else await page.goto(fixtureUrl);
    const answer = page.getByTestId("supportedImagesMarkdown");
    await expect(answer).toContainText("Saved reference images before.");
    await expect(answer).toContainText("Saved reference images after.");
    await expect(answer.getByRole("img")).toHaveCount(supportedImages.length);
    for (const { alt, src } of supportedImages) {
      const image = answer.getByRole("img", { name: alt, exact: true });
      await expect(image).toHaveAttribute("alt", alt);
      await expect(image).toHaveAttribute("src", src);
      await expect(image).toHaveJSProperty("src", new URL(src, fixtureUrl).href);
      await expect(image).toHaveJSProperty("complete", true);
      await expect(image).toHaveJSProperty("naturalWidth", 8);
      await expect(image).toHaveJSProperty("naturalHeight", 6);
    }
    expect(imageRequests.slice(requestsBeforeRender).sort()).toEqual([...expectedUrls].sort());
    expect(unexpectedRequests).toEqual([]);
    await expect(page).toHaveURL(fixtureUrl);
  }
});

test("saved undefined collapsed and shortcut references stay literal after reload", { tag: "@destinations" }, async ({ page, context }) => {
  const fixtureUrl = "http://127.0.0.1:5199/tests/tutor-markdown.html?supported-destinations";
  const navigationRequests: string[] = [];
  const navigations: string[] = [];
  const unexpectedRequests: string[] = [];
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest()) navigationRequests.push(url.href);
    if (url.origin === "https://fonts.googleapis.com" && request.resourceType() === "stylesheet") {
      return route.fulfill({ contentType: "text/css", body: "" });
    }
    if (url.origin === new URL(fixtureUrl).origin &&
        (!request.isNavigationRequest() || url.href === fixtureUrl)) {
      return route.continue();
    }
    unexpectedRequests.push(url.href);
    return route.abort();
  });

  let initialHtml: string | undefined;
  for (const reopen of [false, true]) {
    if (reopen) await page.reload();
    else await page.goto(fixtureUrl);
    const answer = page.getByTestId("supportedDestinations");
    await expect(answer).toContainText("Saved supported references before.");
    await expect(answer).toContainText("Saved supported references after.");
    // Count all anchors, including anchors without href or an accessible role.
    await expect(answer.locator("a")).toHaveCount(supportedLinks.length);
    for (const { label, href } of supportedLinks) {
      await expect(answer.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    }
    const requestsBeforeClicks = [...navigationRequests];
    const navigationsBeforeClicks = [...navigations];
    for (const literal of undefinedReferences) {
      const paragraph = answer.locator("p").filter({ hasText: literal });
      await expect(paragraph).toBeVisible();
      expect(await paragraph.textContent()).toBe(literal);
      await expect(paragraph.locator("a")).toHaveCount(0);
      await paragraph.click();
      await expect(page).toHaveURL(fixtureUrl);
      await expect(paragraph).toHaveText(literal);
    }
    expect(navigationRequests).toEqual(requestsBeforeClicks);
    expect(navigations).toEqual(navigationsBeforeClicks);
    expect(unexpectedRequests).toEqual([]);
    expect(context.pages()).toEqual([page]);
    const html = await answer.innerHTML();
    if (reopen) expect(html).toBe(initialHtml);
    else initialHtml = html;
  }
});

for (const { label, href } of supportedLinks) {
  test(`saved ${label} renders and navigates before and after reopening`, async ({ page, context }) => {
    const fixtureUrl = "http://127.0.0.1:5199/tests/tutor-markdown.html?supported-destinations";
    const destination = new URL(href, fixtureUrl);
    const requestUrl = new URL(destination);
    requestUrl.hash = "";
    const fragmentOnly = href.startsWith("#");
    const destinationRequests: string[] = [];
    const unexpectedRequests: string[] = [];
    // Install before rendering, including same-origin relative destinations.
    // Fragment navigation stays in-document and must not make a request.
    await context.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!fragmentOnly && url.href === requestUrl.href) {
        destinationRequests.push(url.href);
        return route.fulfill({
          contentType: "text/html",
          body: '<h1 id="details">Synthetic supported reference destination</h1>',
        });
      }
      if (url.origin === "https://fonts.googleapis.com" && request.resourceType() === "stylesheet") {
        return route.fulfill({ contentType: "text/css", body: "" });
      }
      if (url.origin === new URL(fixtureUrl).origin &&
          (!request.isNavigationRequest() || url.href === fixtureUrl)) {
        return route.continue();
      }
      unexpectedRequests.push(url.href);
      return route.abort();
    });

    for (const reopen of [false, true]) {
      await page.goto(fixtureUrl);
      if (reopen) await page.reload();
      const answer = page.getByTestId("supportedDestinations");
      await expect(answer).toContainText("Saved supported references before.");
      await expect(answer).toContainText("Saved supported references after.");
      // Check every label and raw href, not merely the clicked destination.
      await expect(answer.getByRole("link")).toHaveCount(supportedLinks.length);
      for (const link of supportedLinks) {
        const renderedLink = answer.getByRole("link", { name: link.label, exact: true });
        await expect(renderedLink).toBeVisible();
        await expect(renderedLink).toHaveText(link.label);
        // Playwright text matchers normalize whitespace; compare the DOM text
        // too so reference normalization cannot silently rewrite the label.
        expect(await renderedLink.textContent()).toBe(link.label);
        await expect(renderedLink).toHaveAttribute("href", link.href);
        await expect(renderedLink).toHaveJSProperty("href", new URL(link.href, fixtureUrl).href);
      }
      const requestsBeforeClick = destinationRequests.length;
      await answer.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(destination.href);
      if (fragmentOnly) {
        await expect(page.locator(":target")).toHaveText("Synthetic fragment destination");
        await expect(answer).toBeVisible();
        expect(destinationRequests).toHaveLength(0);
      } else {
        await expect(page.getByRole("heading")).toHaveText("Synthetic supported reference destination");
        expect(destinationRequests.slice(requestsBeforeClick)).toEqual([requestUrl.href]);
      }
      expect(unexpectedRequests).toEqual([]);
      expect(context.pages()).toEqual([page]);
    }
  });
}

for (const [name, codeSelector] of [
  ["quotedDelimiters", "blockquote > pre > code"],
  ["listedDelimiters", "ul > li > pre > code"],
  ["quotedListDelimiters", "blockquote > ol > li > pre > code"],
  ["indentedDelimiters", ".prose > pre > code"],
] as const) {
  test(`saved ${name} preserve literal code and surrounding math after reload`, async ({ page }) => {
    await page.goto("/tests/tutor-markdown.html");
    for (const reopen of [false, true]) {
      if (reopen) await page.reload();
      const answer = page.getByTestId(name);
      const code = answer.locator(codeSelector);
      await expect(code).toHaveCount(1);
      // Unlike toHaveText, this comparison does not normalize whitespace.
      expect(await code.textContent()).toBe(`${nestedLiteralMath}\n`);
      await expect(answer.locator("pre")).toHaveCount(1);
      await expect(answer.locator("pre .katex")).toHaveCount(0);
      await expect(answer.locator(".katex")).toHaveCount(2);
      await expect(answer.locator(".katex-display")).toHaveCount(1);
      await expect(answer.locator(".katex-error")).toHaveCount(0);
      expect(await answer.locator('.katex annotation[encoding="application/x-tex"]').allTextContents())
        .toEqual(["7 + 1 = 8", "9 = 9"]);
      await expect(answer).toContainText("Before:");
      await expect(answer).toContainText("After:");
    }
  });
}

test("saved inline code preserves backslash delimiters and backticks beside prose math", async ({ page }) => {
  await page.goto("/tests/tutor-markdown.html?inline");
  for (const reopen of [false, true]) {
    if (reopen) await page.reload();
    const answer = page.getByTestId("inlineDelimiterExamples");
    await expect(answer.locator("code")).toHaveCount(4);
    // Unlike toHaveText, textContent equality does not normalize whitespace.
    expect(await answer.locator("code").allTextContents()).toEqual([
      String.raw`\(x + 1\)`,
      String.raw`\[y = 2\]`,
      String.raw`\(a\) ` + "`literal`" + String.raw` \[b\]`,
      String.raw`\[c\] ` + "``literal``" + String.raw` \(d\)`,
    ]);
    await expect(answer.locator("pre, code .katex, .katex-error")).toHaveCount(0);
    await expect(answer.locator(".katex")).toHaveCount(8);
    await expect(answer.locator(".katex-display")).toHaveCount(1);
    // Check the actual prose equations, not just the presence of math nodes.
    expect(await answer.locator('.katex annotation[encoding="application/x-tex"]').allTextContents())
      .toEqual(["1 + 1 = 2", "3 = 3", "4 = 4", "5 = 5", "6 = 6", "7 = 7", "8 = 8", "9 = 9"]);
  }
});

test("saved fenced delimiters stay literal while surrounding prose renders math", async ({ page }) => {
  await page.goto("/tests/tutor-markdown.html");
  await page.reload();
  const examples = page.getByTestId("delimiterExamples");
  // textContent equality deliberately checks whitespace as well as backslashes.
  expect(await examples.locator("pre code").allTextContents()).toEqual([
    `${literalMath}\n`,
    `${literalMath}\n~~~\n`,
    `${literalMath}\n\`\`\`\n`,
  ]);
  await expect(examples.locator("pre .katex")).toHaveCount(0);
  await expect(examples.locator(".katex")).toHaveCount(3);
  await expect(examples.locator(".katex-display")).toHaveCount(1);
  await expect(examples.locator(".katex-error")).toHaveCount(0);
  expect(await page.getByTestId("unclosedDelimiterFence").locator("pre code").textContent())
    .toBe(`${literalMath}\n`);
});

test("saved unsafe links and image destinations stay inert after reopening", { tag: "@destinations" }, async ({ page, context }) => {
  // This case clicks 28 sanitized links across initial render and reopening.
  // Empty hrefs reload the fixture: the default 30s budget expires mid-assertion
  // even when sanitization is correct. Keep every assertion and allow the full
  // sequence to finish (measured ~50s on the workspace Chromium host).
  test.setTimeout(180_000);
  const dialogs: string[] = [];
  const unexpectedRequests: string[] = [];
  const imageRequests: string[] = [];
  const sourceRequests: string[] = [];
  const navigations: string[] = [];
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  // Install before rendering. No external destination may reach the network,
  // even if a future renderer regression starts fetching a hostile image.
  await context.route("**/*", async route => {
    const url = route.request().url();
    // The real stylesheet imports Google Fonts; stub CSS, never fetch it.
    if (new URL(url).origin === "https://fonts.googleapis.com" &&
        route.request().resourceType() === "stylesheet") {
      return route.fulfill({ contentType: "text/css", body: "" });
    }
    if (url === safeImage) {
      imageRequests.push(url);
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>',
      });
    }
    if (url === safeSource.split("#")[0]) {
      sourceRequests.push(url);
      return route.fulfill({ contentType: "text/html", body: "<h1>Synthetic HTTPS destination</h1>" });
    }
    if (new URL(url).origin === "http://127.0.0.1:5199") return route.continue();
    unexpectedRequests.push(url);
    return route.abort();
  });
  await page.goto("/tests/tutor-markdown.html?destinations");
  const fixtureUrl = page.url();

  for (const reopen of [false, true]) {
    if (reopen) await page.reload();
    const answer = page.getByTestId("destinations");
    await expect(answer).toContainText("Saved destinations before.");
    await expect(answer).toContainText("Saved destinations after.");
    for (const { name } of unsafeDestinations) {
      for (const form of ["inline", "reference"]) {
        const link = answer.locator("a").filter({ hasText: new RegExp(`^${name} ${form} link$`) });
        await expect(link).toHaveCount(1);
        expect([null, ""]).toContain(await link.getAttribute("href"));
        await link.click();
        await expect(page).toHaveURL(fixtureUrl);
        const image = answer.getByRole("img", { name: `${name} ${form} image`, exact: true });
        await expect(image).toHaveCount(1);
        expect([null, ""]).toContain(await image.getAttribute("src"));
        expect(await image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(0);
      }
    }
    await expect(answer.getByRole("link", { name: "Supported HTTPS source", exact: true })).toHaveAttribute("href", safeSource);
    await expect.poll(() => answer.locator("[href]").evaluateAll(nodes =>
      nodes.map(node => node.getAttribute("href")).filter(Boolean),
    )).toEqual([safeSource]);
    await expect.poll(() => answer.locator("[src]").evaluateAll(nodes =>
      nodes.map(node => node.getAttribute("src")).filter(Boolean),
    )).toEqual([safeImage]);
    const supportedImage = answer.getByRole("img", { name: "Supported HTTPS image", exact: true });
    await expect(supportedImage).toHaveJSProperty("naturalWidth", 8);
    await expect(answer.locator("script, iframe, object, embed")).toHaveCount(0);
    expect(dialogs).toEqual([]);
    expect(unexpectedRequests).toEqual([]);
    expect(navigations.every(url => url === fixtureUrl)).toBe(true);
    expect(context.pages()).toEqual([page]);
  }
  expect(sourceRequests).toEqual([]);
  expect(imageRequests.length).toBeGreaterThanOrEqual(2);
  await page.getByRole("link", { name: "Supported HTTPS source", exact: true }).click();
  await expect(page).toHaveURL(safeSource);
  await expect(page.getByRole("heading")).toHaveText("Synthetic HTTPS destination");
  expect(sourceRequests).toEqual([safeSource.split("#")[0]]);
  expect(dialogs).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
});

test("saved hostile Markdown remains inert while source links work after reopening", async ({ page }) => {
  const dialogs: string[] = [];
  const hostileRequests: string[] = [];
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  page.on("request", request => {
    if (request.url().includes("/hostile-image")) hostileRequests.push(request.url());
  });
  await page.goto("/tests/tutor-markdown.html?security");

  // Check both the initial render and a reopened saved answer.
  for (const reopen of [false, true]) {
    if (reopen) await page.reload();
    const answer = page.getByTestId("hostile");
    await expect(answer).toContainText("Saved answer before hostile content.");
    await expect(answer).toContainText("Saved answer after hostile content.");
    for (const html of hostileHtml) await expect(answer).toContainText(html);
    await expect(answer.locator("script, img, button, iframe, object, embed")).toHaveCount(0);
    expect(await answer.evaluate(el =>
      [...el.querySelectorAll("*")].flatMap(node =>
        [...node.attributes].filter(attr => /^on/i.test(attr.name)).map(attr => attr.name),
      ),
    )).toEqual([]);

    for (const label of [
      "Unsafe Markdown link", "Mixed-case unsafe link",
      "Entity-encoded unsafe link", "Reference unsafe link",
    ]) {
      const link = answer.locator("a").filter({ hasText: label });
      await expect(link).toHaveText(label);
      // react-markdown may remove href or replace it with an empty string.
      expect([null, ""]).toContain(await link.getAttribute("href"));
      await link.click();
      expect(new URL(page.url()).pathname).toBe("/tests/tutor-markdown.html");
    }
    await expect.poll(() => answer.locator("[href]").evaluateAll(nodes =>
      nodes.map(node => node.getAttribute("href")).filter(Boolean),
    )).toEqual(["https://example.org/synthetic-source?section=2#reference"]);
    expect(await page.evaluate(() => document.documentElement.dataset.hostileExecuted)).toBeUndefined();
    expect(dialogs).toEqual([]);
    expect(hostileRequests).toEqual([]);
  }

  // Fulfill locally: prove actual navigation without contacting an external site.
  await page.route("https://example.org/synthetic-source?section=2", route =>
    route.fulfill({ contentType: "text/html", body: "<h1>Synthetic source destination</h1>" }),
  );
  await page.getByRole("link", { name: "Normal source", exact: true }).click();
  await expect(page).toHaveURL("https://example.org/synthetic-source?section=2#reference");
  await expect(page.getByRole("heading")).toHaveText("Synthetic source destination");
});

for (const width of [320, 390, 1280]) {
  test(`saved warnings and original claims remain readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/tests/tutor-markdown.html");
    // Reopening must render the same stored Markdown without a live response.
    await page.reload();
    const mixed = page.getByTestId("mixed");
    await expect(mixed.locator("strong").first()).toHaveText("Arithmetic check: mismatch detected.");
    await expect(mixed).toContainText("1 passed; 1 mismatched; 1 unchecked marked calculations.");
    await expect(mixed).toContainText("1 passed; 1 mismatched; 2 unchecked marked conversions.");
    await expect(mixed).toContainText("Conversion 2: incompatible dimensions. Do not rely on the displayed conversion.");
    await expect(mixed).toContainText("Conversion 3: unsupported unit, syntax or numeric range.");
    await expect(mixed).toContainText("Do not rely on the displayed result.");
    await expect(mixed.locator("pre code.language-arithmetic")).toHaveText(arithmetic);
    await expect(mixed.locator("pre code.language-units")).toHaveText(units);
    for (const name of ["mixed", "limited", "unchecked"]) {
      const answer = page.getByTestId(name);
      await expect(answer).toContainText(physicalDisclaimer);
      await expect(answer).toContainText(unitDisclaimer);
      await expect(answer.locator("strong")).not.toContainText(["Physically verified"]);
    }
    await expect(page.getByTestId("limited")).toContainText("Unit conversion/dimension check: limited check.");
    await expect(page.getByTestId("limited")).toContainText("1 passed; 0 mismatched; 0 unchecked marked conversions.");
    await expect(page.getByTestId("unchecked")).toContainText("Units unchecked.");
    await expect(page.getByTestId("unchecked")).toContainText("Original unmarked claim: 1 [V] = 1 [A].");

    // Measure real browser layout, not just class names. Prose must wrap,
    // while long code remains available in its own scroll container.
    const layout = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("article, .prose, .prose p, .prose pre")];
      return {
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        boxesFit: nodes.every(node => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return rect.left >= 0 && rect.right <= innerWidth + 1 &&
            rect.height > 0 && style.visibility === "visible" &&
            style.overflowX !== "hidden" && style.overflowX !== "clip";
        }),
        proseFits: [...document.querySelectorAll(".prose p")].every(p => p.scrollWidth <= p.clientWidth + 1),
      };
    });
    expect(layout).toEqual({ pageFits: true, boxesFit: true, proseFits: true });
    const block = mixed.locator("pre").filter({ has: page.locator("code.language-units") });
    await block.scrollIntoViewIfNeeded();
    const scroll = await block.evaluate(el => {
      el.scrollLeft = el.scrollWidth;
      return { overflow: getComputedStyle(el).overflowX, reachedEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 };
    });
    expect(scroll).toEqual({ overflow: "auto", reachedEnd: true });
  });
}
