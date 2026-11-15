import assert from "node:assert/strict";
import { test } from "node:test";
import { ReadCareerScreenshotBatchBody, ReadCareerScreenshotsBody, type ScreenshotImage } from "@workspace/api-zod";
import { sanitizeScreenshotDraft, ScreenshotReadError, validateScreenshotImages } from "./career-screenshots";
import { acquireCareerAiSlot } from "./career-ai-limits";
import { readScreenshotBatch } from "./career-screenshot-batch";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1EAAAAASUVORK5CYII=", "base64");
function image(buffer = png, contentType: ScreenshotImage["contentType"] = "image/png"): ScreenshotImage {
  return { fileName: "screenshot.png", contentType, dataBase64: buffer.toString("base64") };
}
const rejects = (images: ScreenshotImage[]) => assert.throws(() => validateScreenshotImages(images), ScreenshotReadError);

test("a small PNG screenshot passes format validation", () => {
  assert.doesNotThrow(() => validateScreenshotImages([image()]));
});

test("invalid base64, empty images, false types, and executable formats are rejected", () => {
  rejects([{ ...image(), dataBase64: "!!!!" }]);
  rejects([{ ...image(), dataBase64: "abc" }]);
  rejects([image(Buffer.alloc(0))]);
  rejects([image(png, "image/jpeg")]);
  rejects([image(Buffer.from("<svg><script>alert(1)</script></svg>"))]);
  rejects([image(Buffer.from("not a real image"))]);
});

test("one oversized image and excessive combined size are rejected", () => {
  const big = Buffer.alloc(5 * 1024 * 1024 + 1);
  png.copy(big);
  rejects([image(big)]);
  const medium = Buffer.alloc(4 * 1024 * 1024);
  png.copy(medium);
  rejects([image(medium), image(medium), image(medium)]);
});

test("zero-dimension and excessive-dimension PNG files are rejected", () => {
  const invalid = Buffer.from(png);
  invalid.writeUInt32BE(0, 16);
  rejects([image(invalid)]);
  invalid.writeUInt32BE(10000, 16);
  invalid.writeUInt32BE(10000, 20);
  rejects([image(invalid)]);
});

test("the request schema enforces image count, target, and supported formats", () => {
  const input = { target: "opportunity", images: [image()] };
  assert.equal(ReadCareerScreenshotsBody.safeParse(input).success, true);
  assert.equal(ReadCareerScreenshotsBody.safeParse({ ...input, images: [] }).success, false);
  assert.equal(ReadCareerScreenshotsBody.safeParse({ ...input, images: Array(6).fill(image()) }).success, false);
  assert.equal(ReadCareerScreenshotsBody.safeParse({ ...input, target: "account" }).success, false);
  assert.equal(ReadCareerScreenshotsBody.safeParse({ ...input, images: [{ ...image(), contentType: "image/svg+xml" }] }).success, false);
});

test("AI concurrency is bounded and releasing a slot twice is safe", () => {
  const release = Array.from({ length: 4 }, () => acquireCareerAiSlot());
  try {
    assert.ok(release.every(Boolean));
    assert.equal(acquireCareerAiSlot(), undefined);
    release[0]!();
    release[0]!();
    const next = acquireCareerAiSlot();
    assert.ok(next);
    assert.equal(acquireCareerAiSlot(), undefined);
    next();
  } finally {
    release.forEach(fn => fn?.());
  }
});

test("submission dates cannot become application deadlines", () => {
  const result = sanitizeScreenshotDraft("opportunity", {
    fields: { title: "Junior Analyst", status: "applied", deadline: "2026-11-14" },
    extractedText: "Thanks for applying! Submitted November 14, 2026.",
    warnings: [],
  });
  assert.equal(result.fields.status, "applied");
  assert.equal(result.fields.deadline, undefined);
  assert.ok(result.warnings.length);
});

test("explicit application deadlines survive while invalid dates and unsafe links do not", () => {
  const result = sanitizeScreenshotDraft("opportunity", {
    fields: { title: "Analyst", deadline: "2026-12-01", interviewAt: "2026-02-30T25:99", url: "javascript:alert(1)" },
    extractedText: "Application deadline: December 1, 2026.",
    warnings: [],
  });
  assert.equal(result.fields.deadline, "2026-12-01");
  assert.equal(result.fields.interviewAt, undefined);
  assert.equal(result.fields.url, undefined);
});

test("fields from another tab are removed and unreadable results fail explicitly", () => {
  const result = sanitizeScreenshotDraft("coach", {
    fields: { title: "Unrelated title", question: "Tell me about yourself." },
    extractedText: "Tell me about yourself.",
    warnings: [],
  });
  assert.equal(result.fields.title, undefined);
  assert.equal(result.fields.question, "Tell me about yourself.");
  assert.equal(result.fields.answer, undefined);
  assert.throws(() => sanitizeScreenshotDraft("strengths", { fields: {}, extractedText: "", warnings: ["No results visible."] }), ScreenshotReadError);
});

for (const count of [1, 4, 5]) {
  test(`${count} screenshots produce ${count} independent drafts in their original order`, async () => {
    const images = Array.from({ length: count }, (_, n) => ({ ...image(), fileName: `Role ${n + 1}.png` }));
    const seen: string[] = [];
    const output = await readScreenshotBatch({ target: "opportunity", images }, async (input) => {
      assert.equal(input.images.length, 1);
      const name = input.images[0].fileName;
      seen.push(name);
      return { fields: { title: name, company: `Employer ${name}`, status: "applied" }, extractedText: name, warnings: [] };
    });
    assert.equal(seen.length, count);
    assert.equal(output.items.length, count);
    assert.deepEqual(output.items.map(item => item.draft?.fields.title), images.map(item => item.fileName));
    assert.deepEqual(output.items.map(item => item.index), Array.from({ length: count }, (_, n) => n));
    assert.ok(output.items.every(item => item.status === "ready"));
  });
}

test("one unreadable image and one invalid image leave the other drafts intact", async () => {
  const images = [
    { ...image(), fileName: "Good 1.png" },
    { ...image(), fileName: "Unreadable.png" },
    { ...image(), fileName: "Invalid.png", dataBase64: Buffer.from("bad image").toString("base64") },
    { ...image(), fileName: "Good 4.png" },
  ];
  const output = await readScreenshotBatch({ target: "opportunity", images }, async (input) => {
    if (input.images[0].fileName === "Unreadable.png") throw new ScreenshotReadError(422, "No readable job information.");
    return { fields: { title: input.images[0].fileName }, extractedText: "Role", warnings: [] };
  });
  assert.deepEqual(output.items.map(item => item.status), ["ready", "error", "error", "ready"]);
  assert.equal(output.items[3].draft?.fields.title, "Good 4.png");
  assert.equal(output.items[1].error, "No readable job information.");
});

test("same filenames are not merged and a sixth screenshot is rejected", async () => {
  const images = Array.from({ length: 5 }, () => image());
  assert.equal(ReadCareerScreenshotBatchBody.safeParse({ target: "opportunity", images }).success, true);
  assert.equal(ReadCareerScreenshotBatchBody.safeParse({ target: "opportunity", images: [...images, image()] }).success, false);
  const output = await readScreenshotBatch({ target: "experience", images }, async () => ({
    fields: { title: "Project" }, extractedText: "Project evidence", warnings: [],
  }));
  assert.equal(output.items.length, 5);
});
