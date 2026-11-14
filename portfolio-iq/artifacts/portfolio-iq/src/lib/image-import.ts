import type { BudgetEntryInput, DetectedHolding, DetectedReceipt, HoldingInput, HoldingInputType } from "@workspace/api-client-react";
import { centsToInput, toCents } from "@/lib/money";

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 3000;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 7_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL_RE = /^[A-Za-z0-9.^/-]+$/;
export const HOLDING_TYPES: HoldingInputType[] = ["ETF", "Stock", "Bond", "Cash", "Crypto", "Other"];

/** Returns a user-facing problem with the file, or null if it can be read. */
export function checkImageFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (/\.(heic|heif)$/.test(name) || /heic|heif/.test(file.type)) return "HEIC photos can't be read here. On iPhone, set Camera > Formats to Most Compatible, or take a screenshot of the photo and choose that PNG instead.";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "PDFs aren't supported. Take a screenshot of the page and choose the PNG or JPEG.";
  if (!ACCEPTED_TYPES.includes(file.type)) return "Choose a PNG, JPEG, or WebP image.";
  if (file.size > MAX_FILE_BYTES) return `This image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 15 MB; crop it or take a smaller screenshot.`;
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image couldn't be opened. It may be damaged; try another screenshot."));
    img.src = url;
  });
}

/** Read the image locally, downscale if large, and encode within the server budget. Nothing is stored. */
export async function prepareImage(previewUrl: string): Promise<string> {
  const img = await loadImage(previewUrl);
  let scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't prepare this image.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const url = canvas.toDataURL("image/jpeg", attempt < 2 ? 0.9 : 0.82);
    canvas.width = 0; canvas.height = 0;
    const bytes = Math.ceil(((url.length - url.indexOf(",") - 1) * 3) / 4);
    if (bytes <= MAX_PAYLOAD_BYTES && url.length <= MAX_DATA_URL_CHARS) return url;
    scale *= 0.75;
  }
  throw new Error("This image is too detailed to send. Crop it to just the table or receipt and try again.");
}

export const newRequestId = () => crypto.randomUUID();
const key = () => Math.random().toString(36).slice(2, 10);

export type HoldingRow = {
  key: string; selected: boolean;
  symbol: string; name: string; type: HoldingInputType | ""; quantity: string; price: string; costBasis: string; priceDate: string; notes: string;
  warnings: string[]; dateWasRead: boolean;
};

export function toHoldingRow(d: DetectedHolding): HoldingRow {
  return {
    key: key(), selected: true,
    symbol: d.symbol ?? "", name: d.name ?? "", type: d.type ?? "",
    quantity: d.quantity == null ? "" : String(d.quantity),
    price: centsToInput(d.priceCents), costBasis: centsToInput(d.costBasisCents),
    priceDate: d.priceDate && DATE_RE.test(d.priceDate) ? d.priceDate : "",
    notes: d.notes ? `Image note (as read): ${d.notes}`.slice(0, 2000) : "", warnings: d.warnings ?? [], dateWasRead: !!d.priceDate && DATE_RE.test(d.priceDate),
  };
}

export function holdingProblems(r: HoldingRow): Partial<Record<keyof HoldingRow, string>> {
  const p: Partial<Record<keyof HoldingRow, string>> = {};
  const s = r.symbol.trim();
  if (!s) p.symbol = "Symbol missing";
  else if (s.length > 16 || !SYMBOL_RE.test(s)) p.symbol = "Letters, numbers, . ^ / - only (16 max)";
  if (!r.name.trim()) p.name = "Name missing";
  if (!r.type) p.type = "Pick a type";
  const q = Number(r.quantity);
  if (!r.quantity.trim() || !Number.isFinite(q) || q <= 0) p.quantity = "Enter a quantity above 0";
  const pc = toCents(r.price);
  if (pc == null || Number.isNaN(pc)) p.price = "Enter a price like 12.34";
  const cb = toCents(r.costBasis);
  if (cb != null && Number.isNaN(cb)) p.costBasis = "Leave blank or enter dollars";
  if (!DATE_RE.test(r.priceDate)) p.priceDate = "Choose the price date";
  return p;
}

export function toHoldingInput(r: HoldingRow): HoldingInput {
  return {
    symbol: r.symbol.trim().toUpperCase(), name: r.name.trim(), type: r.type as HoldingInputType,
    quantity: Number(r.quantity), priceCents: toCents(r.price) ?? 0, costBasisCents: toCents(r.costBasis),
    priceDate: r.priceDate, notes: r.notes.slice(0, 2000),
  };
}

export type ReceiptForm = { description: string; category: string; amount: string; date: string; notes: string; warnings: string[]; dateWasRead: boolean };

export function toReceiptForm(d: DetectedReceipt | null): ReceiptForm {
  const okDate = !!d?.date && DATE_RE.test(d.date);
  return {
    description: d?.description ?? "", category: d?.category ?? "", amount: centsToInput(d?.amountCents),
    date: okDate ? d!.date! : "", notes: d?.notes ?? "", warnings: d?.warnings ?? [], dateWasRead: okDate,
  };
}

export function receiptProblems(f: ReceiptForm): Partial<Record<keyof ReceiptForm, string>> {
  const p: Partial<Record<keyof ReceiptForm, string>> = {};
  if (!f.description.trim()) p.description = "Add the merchant or a short description";
  if (!f.category.trim()) p.category = "Pick or type a category";
  const c = toCents(f.amount);
  if (c == null || Number.isNaN(c) || c < 1) p.amount = "Enter the total you paid, like 24.99";
  if (!DATE_RE.test(f.date)) p.date = "Choose the purchase date";
  return p;
}

export function toEntryInput(f: ReceiptForm): BudgetEntryInput {
  return { description: f.description.trim().slice(0, 160), category: f.category.trim().slice(0, 50), type: "Expense", amountCents: toCents(f.amount) ?? 0, date: f.date, notes: f.notes.slice(0, 2000) };
}
