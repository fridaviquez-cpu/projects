import type { HoldingInput, Holding } from "@workspace/api-client-react";

export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_ROWS = 200;

export type FieldKey = "symbol" | "name" | "type" | "quantity" | "price" | "cost" | "date";
export const FIELDS: { key: FieldKey; label: string; required: boolean; aliases: string[] }[] = [
  { key: "symbol", label: "Symbol", required: true, aliases: ["symbol", "ticker", "ticker symbol", "code"] },
  { key: "name", label: "Name", required: true, aliases: ["name", "description", "security", "security name", "holding"] },
  { key: "type", label: "Type", required: true, aliases: ["type", "asset type", "asset class", "class", "category"] },
  { key: "quantity", label: "Quantity", required: true, aliases: ["quantity", "qty", "shares", "units"] },
  { key: "price", label: "Unit price (USD)", required: true, aliases: ["price", "unit price", "price usd", "price per unit", "last price", "manual price"] },
  { key: "cost", label: "Total cost basis (USD)", required: false, aliases: ["cost", "cost basis", "total cost", "total cost basis", "total paid", "cost basis usd"] },
  { key: "date", label: "Snapshot date", required: false, aliases: ["date", "price date", "as of", "snapshot date", "as of date"] },
];
export type Mapping = Record<FieldKey, number | null>;

export const TEMPLATE = `symbol,name,type,quantity,price,cost_basis,price_date
VTI,Vanguard Total Stock Market ETF,ETF,12.5,287.40,3150.00,2025-01-15
AAPL,"Apple Inc., common",Stock,4,231.10,,2025-01-15
CASH,Emergency savings,Cash,1,5200.00,5200.00,2025-01-15
`;

/** RFC 4180-ish parser. Throws on malformed quotes or ragged rows. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [], cell = "", i = 0, inQ = false, wasQuoted = false, line = 1;
  const endCell = () => { row.push(wasQuoted ? cell : cell.trim()); cell = ""; wasQuoted = false; };
  const endRow = () => { endCell(); if (!(row.length === 1 && row[0] === "")) rows.push(row); row = []; line++; };
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++;
        while (text[i] === " " || text[i] === "\t") i++;
        if (i < text.length && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") throw new Error(`Line ${line}: unexpected text after a closing quote.`);
        continue;
      }
      if (c === "\n") line++;
      cell += c; i++; continue;
    }
    if (c === '"') {
      if (cell.trim() !== "") throw new Error(`Line ${line}: a quote appears in the middle of a cell. Wrap the whole cell in quotes and double inner quotes ("").`);
      cell = ""; inQ = true; wasQuoted = true; i++; continue;
    }
    if (c === ",") { endCell(); i++; continue; }
    if (c === "\r") { endRow(); i += text[i + 1] === "\n" ? 2 : 1; continue; }
    if (c === "\n") { endRow(); i++; continue; }
    cell += c; i++;
  }
  if (inQ) throw new Error("A quoted cell is never closed.");
  if (cell !== "" || wasQuoted || row.length) endRow();
  if (!rows.length) throw new Error("The file is empty.");
  const w = rows[0].length;
  rows.forEach((r, idx) => { if (r.length !== w) throw new Error(`Row ${idx + 1} has ${r.length} cells but the header has ${w}.`); });
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-$()]/g, " ").replace(/\busd\b/g, " usd").replace(/\s+/g, " ").trim();
export function autoMap(headers: string[]): Mapping {
  const m = { symbol: null, name: null, type: null, quantity: null, price: null, cost: null, date: null } as Mapping;
  const used = new Set<number>();
  for (const f of FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.aliases.includes(norm(h)));
    if (idx >= 0) { m[f.key] = idx; used.add(idx); }
  }
  return m;
}

const TYPES = ["ETF", "Stock", "Bond", "Cash", "Crypto", "Other"];
const typeOf = (s: string) => TYPES.find((t) => t.toLowerCase() === s.trim().toLowerCase()) ?? null;

/** Dollars with up to 2 decimals to exact integer cents; no rounding. */
export function dollarsToCents(raw: string): number | null {
  const t = raw.trim().replace(/^\$/, "");
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(t) ?? /^()\.(\d{1,2})$/.exec(t);
  if (!m) return null;
  const whole = m[1].replace(/,/g, "") || "0";
  const cents = Number(whole) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function parseQuantity(raw: string): number | null {
  const original = raw.trim();
  if (!/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,6})?|\.\d{1,6})$/.test(original)) return null;
  const t = original.replace(/,/g, "");
  if (!/^(\d+(\.\d{1,6})?|\.\d{1,6})$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= 1e8 ? n : null;
}
export function validDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export type DupKind = "existing" | "file" | null;
export type ReviewRow = { line: number; values: Record<FieldKey, string>; errors: string[]; holding: HoldingInput | null; dup: DupKind };

export function buildRows(rows: string[][], mapping: Mapping, defaultDate: string, existing: Holding[]): ReviewRow[] {
  const real = new Set(existing.filter((h) => !h.isSample).map((h) => `${h.symbol.toUpperCase()}|${h.type}`));
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const v = {} as Record<FieldKey, string>;
    FIELDS.forEach((f) => { v[f.key] = mapping[f.key] == null ? "" : (r[mapping[f.key]!] ?? "").trim(); });
    const errors: string[] = [];
    const symbol = v.symbol.toUpperCase();
    if (!/^[A-Za-z0-9.^/-]{1,16}$/.test(symbol)) errors.push("Symbol: 1-16 letters, numbers or . ^ / -");
    if (!v.name || v.name.length > 120) errors.push("Name: required, up to 120 characters");
    const type = typeOf(v.type);
    if (!type) errors.push(`Type: one of ${TYPES.join(", ")}`);
    const quantity = parseQuantity(v.quantity);
    if (quantity == null) errors.push("Quantity: above 0, at most 100,000,000, up to 6 decimals");
    const priceCents = dollarsToCents(v.price);
    if (priceCents == null || priceCents > 1e11) errors.push("Price: dollars with up to 2 decimals, at most $1,000,000,000");
    let costBasisCents: number | null = null;
    if (v.cost !== "") {
      costBasisCents = dollarsToCents(v.cost);
      if (costBasisCents == null || costBasisCents > 1e14) errors.push("Cost: dollars with up to 2 decimals, or blank if unknown");
    }
    const date = mapping.date == null ? defaultDate : v.date;
    if (!validDate(date)) errors.push("Date: a real date as YYYY-MM-DD");
    if (quantity != null && priceCents != null) {
      const pos = quantity * priceCents;
      if (!Number.isFinite(pos) || pos > 1e14) errors.push("Position value is too large");
    }
    const ok = errors.length === 0;
    const key = `${symbol}|${type}`;
    let dup: DupKind = null;
    if (ok) { dup = real.has(key) ? "existing" : seen.has(key) ? "file" : null; seen.add(key); }
    return {
      line: i + 2, values: { ...v, date }, errors, dup,
      holding: ok ? { symbol, name: v.name, type: type as HoldingInput["type"], quantity: quantity!, priceCents: priceCents!, costBasisCents: costBasisCents === null ? null : costBasisCents, notes: "", priceDate: date } : null,
    };
  });
}

/** Batch totals must stay safe integers in cents; returns an error message or null. */
export function aggregateError(rows: ReviewRow[], existing: Holding[] = []): string | null {
  let total = existing.reduce((s, h) => s + Math.round(h.quantity * h.priceCents) + (h.costBasisCents ?? 0), 0);
  for (const r of rows) if (r.holding) total += Math.round(r.holding.quantity * r.holding.priceCents) + (r.holding.costBasisCents ?? 0);
  if (!Number.isSafeInteger(total)) return "Combined portfolio amounts would be too large to total safely. Reduce the file.";
  return null;
}
