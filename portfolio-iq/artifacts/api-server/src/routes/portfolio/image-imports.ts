import { createHash, randomUUID } from "node:crypto";
import { Router, json, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import {
  ExtractImageImportBody, ExtractImageImportResponse, ConfirmImageImportBody, ConfirmImageImportResponse,
} from "@workspace/api-zod";
import { editWorkspace, HttpError, requireWorkspace } from "../../lib/portfolio-store";
import { extractImage } from "../../lib/image-extraction";
import { cleanHolding, cleanEntry, checkTotals, checkBudgetAmounts } from "./collections";

const router: IRouter = Router();
const inFlight = new Set<string>();
const imageLimit = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
  message: { error: "You can read 20 images per hour from this connection. Please try again later." },
});

router.post("/image-imports/extract", imageLimit, async (req, res, next) => {
  // Check guest ownership before accepting a larger, transient AI-input body.
  res.locals.imageWorkspace = await requireWorkspace(req);
  next();
}, json({ limit: "8mb" }), async (req, res): Promise<void> => {
  const input = ExtractImageImportBody.parse(req.body);
  const id = res.locals.imageWorkspace.id as string;
  if (inFlight.has(id) || inFlight.size >= 8) throw new HttpError(429, "An image is still being read. Wait a moment before trying again.");
  inFlight.add(id);
  try {
    res.json(ExtractImageImportResponse.parse(await extractImage(input)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    req.log.warn("PortfolioIQ image extraction provider request failed");
    throw new HttpError(503, "Image reading is unavailable right now. Nothing was saved. Keep your photo and try again shortly.");
  } finally { inFlight.delete(id); }
});

router.post("/image-imports/confirm", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = ConfirmImageImportBody.parse(req.body);
  if (input.kind === "holdings" && (!input.holdings.length || input.entries.length)
    || input.kind === "receipt" && (input.entries.length !== 1 || input.holdings.length)) {
    throw new HttpError(400, "Select at least one holding, or review one receipt expense, before saving.");
  }
  const holdings = input.holdings.map(cleanHolding);
  const entries = input.entries.map(cleanEntry);
  if (entries.some((e) => e.type !== "Expense")) throw new HttpError(400, "A receipt import must be an expense.");
  const hash = createHash("sha256").update(JSON.stringify({ kind: input.kind, holdings, entries, allowDuplicates: input.allowDuplicates })).digest("hex");
  const { result } = await editWorkspace(workspace.id, (data) => {
    const previous = data.imageImports?.find((batch) => batch.id === input.requestId);
    if (previous) {
      if (previous.hash !== hash) throw new HttpError(409, "This import was already saved with different details. Start a new import to add another record.");
      return { holdingCount: previous.holdingCount, entryCount: previous.entryCount, skippedCount: previous.skippedCount, alreadySaved: true };
    }
    let holdingCount = 0, entryCount = 0, skippedCount = 0;
    const now = new Date().toISOString();
    for (const holding of holdings) {
      if (!input.allowDuplicates && data.holdings.some((h) => h.symbol.toUpperCase() === holding.symbol)) { skippedCount++; continue; }
      if (data.holdings.length >= 1000) throw new HttpError(400, "Your workspace supports up to 1,000 holdings. Nothing from this import was saved.");
      data.holdings.push({ ...holding, id: randomUUID(), isSample: false, updatedAt: now });
      holdingCount++;
    }
    for (const entry of entries) {
      if (!input.allowDuplicates && data.entries.some((e) =>
        e.type === entry.type && e.amountCents === entry.amountCents && e.date === entry.date
        && e.description.trim().toLowerCase() === entry.description.trim().toLowerCase())) { skippedCount++; continue; }
      if (data.entries.length >= 10000) throw new HttpError(400, "Your workspace supports up to 10,000 budget entries. Nothing from this import was saved.");
      data.entries.unshift({ ...entry, id: randomUUID(), createdAt: now });
      entryCount++;
    }
    checkTotals(data);
    checkBudgetAmounts(data);
    // Bound retry receipts to the latest 1,000 imports. Duplicate-content checks
    // also protect repeat uploads after a retry receipt has aged out.
    data.imageImports = [
      ...(data.imageImports ?? []).slice(-999),
      { id: input.requestId, hash, at: Date.now(), holdingCount, entryCount, skippedCount },
    ];
    return { holdingCount, entryCount, skippedCount, alreadySaved: false };
  });
  res.json(ConfirmImageImportResponse.parse(result));
});

export default router;
