import { Router, type IRouter } from "express";
import { ReadCareerScreenshotBatchBody, ReadCareerScreenshotsBody } from "@workspace/api-zod";
import { careerAiLimiter, careerScreenshotBatchLimiter, acquireCareerAiSlot } from "../lib/career-ai-limits";
import { readCareerScreenshots, ScreenshotReadError, validateScreenshotImages } from "../lib/career-screenshots";
import { readScreenshotBatch } from "../lib/career-screenshot-batch";

const router: IRouter = Router();

router.post("/career/screenshots/batch", careerAiLimiter, careerScreenshotBatchLimiter, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const input = ReadCareerScreenshotBatchBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Choose 1–5 PNG, JPG or WebP screenshots, up to 5 MB each and 10 MB total." });
    return;
  }
  const total = input.data.images.reduce((bytes, image) => bytes + Buffer.byteLength(image.dataBase64, "base64"), 0);
  if (total > 10 * 1024 * 1024) {
    res.status(400).json({ error: "Choose screenshots totaling no more than 10 MB." });
    return;
  }
  try {
    res.json(await readScreenshotBatch(input.data));
  } catch {
    req.log.warn({ category: "screenshot_batch_unavailable" }, "Screenshot batch could not be completed");
    res.status(503).json({ error: "These screenshots could not be processed. Your saved records have not changed. Try again." });
  }
});

router.post("/career/screenshots", careerAiLimiter, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const input = ReadCareerScreenshotsBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Choose 1–5 PNG, JPG or WebP screenshots, up to 5 MB each and 10 MB total." });
    return;
  }
  try {
    validateScreenshotImages(input.data.images);
  } catch (error) {
    res.status(400).json({ error: error instanceof ScreenshotReadError ? error.message : "These images could not be read." });
    return;
  }
  const release = acquireCareerAiSlot();
  if (!release) {
    res.status(429).json({ error: "Image reading is busy right now. Please try again in a moment." });
    return;
  }
  try {
    res.json(await readCareerScreenshots(input.data));
  } catch (error) {
    if (error instanceof ScreenshotReadError) {
      res.status(error.status).json({ error: error.message });
    } else {
      // Never log provider errors, image contents, filenames, or extracted personal information.
      req.log.warn({ category: "screenshot_read_unavailable" }, "Screenshot draft could not be generated");
      res.status(503).json({ error: "We could not finish reading these screenshots. Your saved work has not changed. Try again." });
    }
  } finally {
    release();
  }
});

export default router;
