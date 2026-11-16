import { test, expect } from "@playwright/test";
import { hostileMath, ordinaryMath } from "./tutor-math-security.fixtures";

test("untrusted KaTeX commands stay inert in saved inline and display math", async ({ page }) => {
  const dialogs: string[] = [];
  const requests: string[] = [];
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  // Block and record all synthetic attack destinations, even if trust regresses.
  await page.route("https://example.invalid/**", async route => {
    requests.push(route.request().url());
    await route.abort();
  });
  await page.goto("/tests/tutor-markdown.html?math-security");
  const originalUrl = page.url();

  for (const reopen of [false, true]) {
    if (reopen) await page.reload();
    for (const { name, tex } of hostileMath) {
      for (const mode of ["inline", "display"]) {
        const answer = page.getByTestId(`${name}-${mode}`);
        await expect(answer).toContainText("Before synthetic math.");
        await expect(answer).toContainText("After synthetic math.");
        // Prove the actual math pipeline ran, not just escaped Markdown.
        await expect(answer.locator(".katex")).toHaveCount(2);
        await expect(answer.locator('annotation[encoding="application/x-tex"]').first()).toHaveText(tex);
        await expect(answer.locator(".katex-display")).toHaveCount(mode === "display" ? 1 : 0);
        await expect(answer.locator(".katex-error")).toHaveCount(0);
        await expect(answer.locator("a, img, script, iframe, object, embed, style, link")).toHaveCount(0);
        const unsafeAttributes = await answer.evaluate(el =>
          [...el.querySelectorAll("*")].flatMap(node =>
            [...node.attributes]
              .filter(attr => /^on/i.test(attr.name) ||
                /^(href|src|srcset|xlink:href|action|formaction|srcdoc)$/i.test(attr.name) ||
                attr.name === "data-hostile-math" ||
                (attr.name === "id" && attr.value === "hostile-math-id") ||
                (attr.name === "class" && attr.value.includes("hostile-math-class")) ||
                (attr.name === "style" && /url\s*\(|expression\s*\(/i.test(attr.value)))
              .map(attr => `${attr.name}=${attr.value}`),
          ),
        );
        expect(unsafeAttributes, `${name} (${mode})`).toEqual([]);
        // The ordinary equation after each attack must retain real visual math.
        const normal = answer.locator(".katex").last();
        await expect(normal.locator("annotation")).toHaveText(ordinaryMath);
        await expect(normal.locator(".katex-html")).toBeVisible();
        await expect(normal.locator(".mfrac")).toHaveCount(1);
        await expect(normal.locator(".sqrt")).toHaveCount(1);
        await answer.locator(".katex-html").first().click();
        expect(page.url()).toBe(originalUrl);
      }
    }
    expect(dialogs).toEqual([]);
    expect(requests).toEqual([]);
  }
});
