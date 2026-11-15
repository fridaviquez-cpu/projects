import { rateLimit } from "express-rate-limit";

// Share the same budget across writing and image reading on this public API.
export const careerAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "You have reached the hourly AI limit. Your saved work is safe; try again later." },
});

// A batch can make five image calls. Bound batches separately as well so
// automatic multi-file selection does not multiply the public API allowance.
export const careerScreenshotBatchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "You have reached the hourly screenshot batch limit. Your saved work is safe; try again later." },
});

let activeRequests = 0;
export function acquireCareerAiSlot(): (() => void) | undefined {
  if (activeRequests >= 4) return undefined;
  activeRequests++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeRequests--;
  };
}
