import { useQueryClient } from "@tanstack/react-query";
import { getGetWorkspaceQueryKey, getGetOverviewQueryKey } from "@workspace/api-client-react";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const money = (cents: number | null | undefined) => (cents == null ? "Unknown" : usd.format(cents / 100));
export const money0 = (cents: number) => usd0.format(cents / 100);
export const pct = (n: number | null | undefined, d = 1) => (n == null ? "n/a" : `${n.toFixed(d)}%`);

/** Parse a dollar string into integer cents. Returns null for blank, NaN for invalid. */
export function toCents(input: string): number | null {
  const t = input.trim().replace(/^\$/, "").trim();
  if (t === "") return null;
  if (!/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(t)) return NaN;
  const cents = Math.round(Number(t.replace(/,/g, "")) * 100);
  return Number.isSafeInteger(cents) ? cents : NaN;
}
export const centsToInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));

export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export const thisMonth = () => today().slice(0, 7);

export function errMsg(e: unknown): string {
  if (e && typeof e === "object") {
    const d = (e as { data?: unknown }).data;
    if (d && typeof d === "object") {
      const m = (d as Record<string, unknown>).error ?? (d as Record<string, unknown>).message;
      if (typeof m === "string") return m;
    }
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") {
      if (/failed to fetch|networkerror|network request failed|load failed/i.test(m)) return "We couldn't reach the server. Check your connection, keep any draft open, and try again.";
      return m.replace(/^HTTP \d+ [^:]*:\s*/, "");
    }
  }
  return "Something went wrong.";
}

export function useRefreshWorkspace() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetOverviewQueryKey() }),
      qc.invalidateQueries({ queryKey: ["/api/budget"] }),
    ]);
}

export const TYPE_COLORS: Record<string, string> = {
  ETF: "hsl(16 82% 56%)",
  Stock: "hsl(174 38% 38%)",
  Bond: "hsl(226 42% 30%)",
  Cash: "hsl(40 78% 56%)",
  Crypto: "hsl(330 30% 52%)",
  Other: "hsl(226 12% 60%)",
};
