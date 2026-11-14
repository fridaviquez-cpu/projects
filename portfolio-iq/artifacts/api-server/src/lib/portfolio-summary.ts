import type { PortfolioData } from "@workspace/db";
import { GetOverviewResponse, GetBudgetSummaryResponse, type Insight } from "@workspace/api-zod";

export function portfolioSummary(data: PortfolioData) {
  const values = data.holdings.map((holding) => ({ holding, value: Math.round(holding.quantity * holding.priceCents) }));
  const totalValueCents = values.reduce((sum, item) => sum + item.value, 0);
  const known = values.filter((item) => item.holding.costBasisCents !== null);
  const totalCostBasisCents = known.reduce((sum, item) => sum + (item.holding.costBasisCents ?? 0), 0);
  const gainCents = known.length > 0
    ? known.reduce((sum, item) => sum + item.value - (item.holding.costBasisCents ?? 0), 0) : null;
  const gainPercent = gainCents !== null && totalCostBasisCents > 0 ? (gainCents / totalCostBasisCents) * 100 : null;
  const groups = new Map<string, number>();
  for (const { holding, value } of values) groups.set(holding.type, (groups.get(holding.type) ?? 0) + value);
  const allocation = [...groups].map(([type, valueCents]) => ({
    type, valueCents, percent: totalValueCents > 0 ? (valueCents / totalValueCents) * 100 : 0,
  })).sort((a, b) => b.valueCents - a.valueCents);
  const largest = [...values].sort((a, b) => b.value - a.value)[0];
  const insights: Insight[] = [{
    title: "Snapshots, not live quotes",
    description: "Values use the prices you enter. Refresh them before evaluating a decision. Unrealized gain is not a time-weighted return.",
    tone: "info",
  }];
  if (largest && totalValueCents > 0) {
    const percent = (largest.value / totalValueCents) * 100;
    insights.push({
      title: `${largest.holding.symbol} is your largest position`,
      description: `${percent.toFixed(1)}% of your portfolio's value is in this holding. Fund diversification depends on its underlying investments.`,
      tone: percent > 40 ? "caution" : "info",
    });
  } else {
    insights.push({
      title: "A clear view starts with one holding",
      description: "Add a position and its current price to see what you own. Cost basis is optional, and you can start small.",
      tone: "positive",
    });
  }
  if (known.length < values.length) insights.push({
    title: "Some cost basis is missing",
    description: `Gain is calculated only for ${known.length} of ${values.length} holdings with a known total cost basis. Missing values are never treated as zero.`,
    tone: "caution",
  });
  insights.push({
    title: "Fund overlap needs more data",
    description: "We don't have fund constituent data, so we can't measure overlap or look-through sector exposure. More tickers alone don't guarantee diversification.",
    tone: "info",
  });
  insights.push({
    title: "Give your cash a purpose",
    description: "Set aside cash for near-term needs. Money market funds are not FDIC-insured bank deposits; confirm settled cash with your broker.",
    tone: "info",
  });
  return GetOverviewResponse.parse({
    totalValueCents, totalCostBasisCents, gainCents, gainPercent,
    cashValueCents: groups.get("Cash") ?? 0,
    holdingCount: values.length, knownCostCount: known.length, allocation, insights,
    lastPriceDate: data.holdings.length > 0 ? data.holdings.map((h) => h.priceDate).sort().at(-1)! : null,
    hasSampleData: data.holdings.some((h) => h.isSample),
  });
}

export function budgetSummary(data: PortfolioData, month: string) {
  const entries = data.entries.filter((entry) => entry.date.startsWith(`${month}-`));
  const incomeCents = entries.filter((entry) => entry.type === "Income").reduce((sum, entry) => sum + entry.amountCents, 0);
  const expenses = entries.filter((entry) => entry.type === "Expense");
  const expenseCents = expenses.reduce((sum, entry) => sum + entry.amountCents, 0);
  const categories = new Map<string, number>();
  for (const entry of expenses) categories.set(entry.category, (categories.get(entry.category) ?? 0) + entry.amountCents);
  return GetBudgetSummaryResponse.parse({
    month, incomeCents, expenseCents, balanceCents: incomeCents - expenseCents,
    limitCents: data.budgetLimits[month] ?? 0,
    categories: [...categories].map(([category, amountCents]) => ({ category, amountCents })).sort((a, b) => b.amountCents - a.amountCents),
  });
}
