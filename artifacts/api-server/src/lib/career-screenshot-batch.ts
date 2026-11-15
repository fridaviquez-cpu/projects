import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
import { ReadCareerScreenshotBatchResponse, type ScreenshotBatchInput, type ScreenshotBatchItem } from "@workspace/api-zod";
import { acquireCareerAiSlot } from "./career-ai-limits";
import { readCareerScreenshots, ScreenshotReadError, validateScreenshotImages } from "./career-screenshots";

/**
 * One independent read per source image. Settling each image separately means
 * one bad screenshot cannot discard the other four drafts. The inner batch
 * provides bounded retries/backoff for rate-limited provider calls.
 */
export async function readScreenshotBatch(
  input: ScreenshotBatchInput,
  reader: typeof readCareerScreenshots = readCareerScreenshots,
) {
  const items = await batchProcess(input.images, async (image, index): Promise<ScreenshotBatchItem> => {
    try {
      validateScreenshotImages([image]);
      const [draft] = await batchProcess([image], async (single) => {
        const release = acquireCareerAiSlot();
        if (!release) throw new Error("SCREENSHOT_SERVICE_BUSY");
        try {
          return await reader({ target: input.target, images: [single] });
        } finally {
          release();
        }
      }, { concurrency: 1, retries: 1, minTimeout: 1000, maxTimeout: 3000 });
      return { index, fileName: image.fileName, status: "ready", draft };
    } catch (error) {
      return {
        index, fileName: image.fileName, status: "error",
        error: error instanceof ScreenshotReadError ? error.message :
          error instanceof Error && error.message === "SCREENSHOT_SERVICE_BUSY" ?
            "Image reading is busy. Retry this screenshot in a moment." :
            "This screenshot could not be read. Retry it or choose a clearer image; the other drafts are kept.",
      };
    }
  }, { concurrency: 2, retries: 0 });
  return ReadCareerScreenshotBatchResponse.parse({ items });
}
