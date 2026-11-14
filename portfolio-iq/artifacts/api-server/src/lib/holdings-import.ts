import { createHash, randomUUID } from "node:crypto";
import type { HoldingInput, HoldingsImportInput, HoldingsImportResult } from "@workspace/api-zod";
import type { PortfolioData } from "@workspace/db";
import { HttpError, requireText, validDate } from "./portfolio-store";

export function cleanHolding(input: HoldingInput): HoldingInput {
  validDate(input.priceDate);
  if (!(input.quantity > 0)) throw new HttpError(400, "Quantity must be greater than zero.");
  if (Math.abs(input.quantity * 1e6 - Math.round(input.quantity * 1e6)) > 0.001) throw new HttpError(400, "Quantity supports up to six decimal places.");
  if (!Number.isSafeInteger(Math.round(input.quantity * input.priceCents)) || input.quantity * input.priceCents > 1e14) throw new HttpError(400, "That position value is too large.");
  return { ...input, symbol: requireText(input.symbol, "Symbol").toUpperCase(), name: requireText(input.name, "Holding name") };
}

export function checkHoldingTotals(data: PortfolioData) {
  const total = data.holdings.reduce((sum, h) => sum + Math.round(h.quantity * h.priceCents) + (h.costBasisCents ?? 0), 0);
  if (!Number.isSafeInteger(total)) throw new HttpError(400, "Portfolio amounts exceed the supported range.");
}

/** Called inside editWorkspace's row-locked transaction. No files are retained. */
export function applyHoldingsImport(data: PortfolioData, input: HoldingsImportInput): HoldingsImportResult {
  // Canonical property order comes from validated inputs; normalize text before hashing.
  const holdings = input.holdings.map(cleanHolding);
  const fingerprint = createHash("sha256").update(JSON.stringify({
    duplicateBehavior: input.duplicateBehavior, holdings,
  })).digest("hex");
  const previous = data.holdingImports?.[input.importId];
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new HttpError(409, "This import was already attempted with different content. Start a new import.");
    return { importId: input.importId, imported: previous.imported, skipped: previous.skipped };
  }
  // Never evict receipts: an old retry must not silently turn into a new import.
  if (Object.keys(data.holdingImports ?? {}).length >= 1000) throw new HttpError(400, "This workspace has reached its limit of 1,000 CSV imports.");
  const key = (h: HoldingInput) => `${h.symbol.toUpperCase()}|${h.type}`;
  const seen = new Set(data.holdings.filter((h) => !h.isSample).map(key));
  const additions = [];
  let skipped = 0;
  const now = new Date().toISOString();
  for (const holding of holdings) {
    if (seen.has(key(holding))) {
      if (input.duplicateBehavior === "reject") throw new HttpError(409, `Duplicate ${holding.symbol} (${holding.type}). Nothing was imported. Choose skip or add separately.`);
      if (input.duplicateBehavior === "skip") { skipped++; continue; }
    }
    seen.add(key(holding));
    additions.push({ ...holding, id: randomUUID(), isSample: false, updatedAt: now });
  }
  if (data.holdings.length + additions.length > 1000) throw new HttpError(400, "A workspace supports up to 1,000 holdings. Nothing was imported.");
  data.holdings.push(...additions);
  checkHoldingTotals(data);
  data.holdingImports ??= {};
  data.holdingImports[input.importId] = { fingerprint, imported: additions.length, skipped };
  return { importId: input.importId, imported: additions.length, skipped };
}
