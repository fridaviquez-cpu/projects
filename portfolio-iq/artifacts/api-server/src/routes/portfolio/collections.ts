import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateHoldingBody, CreateHoldingResponse, UpdateHoldingBody, UpdateHoldingParams, UpdateHoldingResponse, DeleteHoldingParams,
  CreateThesisBody, CreateThesisResponse, UpdateThesisBody, UpdateThesisParams, UpdateThesisResponse, DeleteThesisParams,
  CreateBudgetEntryBody, CreateBudgetEntryResponse, UpdateBudgetEntryBody, UpdateBudgetEntryParams, UpdateBudgetEntryResponse, DeleteBudgetEntryParams,
  type ThesisInput, type BudgetEntryInput,
  ImportHoldingsBody, ImportHoldingsResponse,
} from "@workspace/api-zod";
import { editWorkspace, HttpError, requireText, requireWorkspace, validDate } from "../../lib/portfolio-store";
import type { PortfolioData } from "@workspace/db";
import { applyHoldingsImport, cleanHolding, checkHoldingTotals as checkTotals } from "../../lib/holdings-import";
export { cleanHolding, checkHoldingTotals as checkTotals } from "../../lib/holdings-import";

const router: IRouter = Router();

router.post("/holdings/import", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = ImportHoldingsBody.parse(req.body);
  const { result } = await editWorkspace(workspace.id, (data) =>
    ImportHoldingsResponse.parse(applyHoldingsImport(data, input)));
  res.json(result);
});

router.post("/holdings", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = cleanHolding(CreateHoldingBody.parse(req.body));
  const { result } = await editWorkspace(workspace.id, (data) => {
    if (data.holdings.length >= 1000) throw new HttpError(400, "A workspace supports up to 1,000 holdings.");
    const holding = { ...input, id: randomUUID(), isSample: false, updatedAt: new Date().toISOString() };
    data.holdings.push(holding);
    checkTotals(data);
    return holding;
  });
  res.status(201).json(CreateHoldingResponse.parse(result));
});

router.put("/holdings/:id", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { id } = UpdateHoldingParams.parse(req.params);
  const input = cleanHolding(UpdateHoldingBody.parse(req.body));
  const { result } = await editWorkspace(workspace.id, (data) => {
    const index = data.holdings.findIndex((h) => h.id === id);
    if (index < 0) throw new HttpError(404, "Holding not found in your workspace.");
    const holding = { ...input, id, isSample: false, updatedAt: new Date().toISOString() };
    data.holdings[index] = holding;
    checkTotals(data);
    return holding;
  });
  res.json(UpdateHoldingResponse.parse(result));
});

router.delete("/holdings/:id", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { id } = DeleteHoldingParams.parse(req.params);
  await editWorkspace(workspace.id, (data) => {
    const index = data.holdings.findIndex((h) => h.id === id);
    if (index < 0) throw new HttpError(404, "Holding not found in your workspace.");
    data.holdings.splice(index, 1);
  });
  res.sendStatus(204);
});

function cleanThesis(input: ThesisInput): ThesisInput {
  return { ...input, symbol: input.symbol.trim().toUpperCase(), title: requireText(input.title, "Title") };
}

router.post("/theses", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = cleanThesis(CreateThesisBody.parse(req.body));
  const { result } = await editWorkspace(workspace.id, (data) => {
    if (data.theses.length >= 1000) throw new HttpError(400, "A workspace supports up to 1,000 journal entries.");
    const now = new Date().toISOString();
    const thesis = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    data.theses.unshift(thesis);
    return thesis;
  });
  res.status(201).json(CreateThesisResponse.parse(result));
});

router.put("/theses/:id", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { id } = UpdateThesisParams.parse(req.params);
  const input = cleanThesis(UpdateThesisBody.parse(req.body));
  const { result } = await editWorkspace(workspace.id, (data) => {
    const index = data.theses.findIndex((t) => t.id === id);
    if (index < 0) throw new HttpError(404, "Journal entry not found in your workspace.");
    const thesis = { ...data.theses[index], ...input, updatedAt: new Date().toISOString() };
    data.theses[index] = thesis;
    return thesis;
  });
  res.json(UpdateThesisResponse.parse(result));
});

router.delete("/theses/:id", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { id } = DeleteThesisParams.parse(req.params);
  await editWorkspace(workspace.id, (data) => {
    const index = data.theses.findIndex((t) => t.id === id);
    if (index < 0) throw new HttpError(404, "Journal entry not found in your workspace.");
    data.theses.splice(index, 1);
  });
  res.sendStatus(204);
});

export function cleanEntry(input: BudgetEntryInput): BudgetEntryInput {
  validDate(input.date);
  return { ...input, description: requireText(input.description, "Description"), category: requireText(input.category, "Category") };
}

export function checkBudgetAmounts(data: PortfolioData) {
  if (!Number.isSafeInteger(data.entries.reduce((sum, entry) => sum + entry.amountCents, 0))) {
    throw new HttpError(400, "Budget amounts exceed the supported range.");
  }
}

router.post("/budget/entries", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = cleanEntry(CreateBudgetEntryBody.parse(req.body));
  const { result } = await editWorkspace(workspace.id, (data) => {
    if (data.entries.length >= 10000) throw new HttpError(400, "A workspace supports up to 10,000 budget entries.");
    const entry = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    data.entries.unshift(entry);
    checkBudgetAmounts(data);
    return entry;
  });
  res.status(201).json(CreateBudgetEntryResponse.parse(result));
});

router.put("/budget/entries/:id", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { id } = UpdateBudgetEntryParams.parse(req.params);
  const input = cleanEntry(UpdateBudgetEntryBody.parse(req.body));
  const { result } = await editWorkspace(workspace.id, (data) => {
    const index = data.entries.findIndex((e) => e.id === id);
    if (index < 0) throw new HttpError(404, "Budget entry not found in your workspace.");
    const entry = { ...data.entries[index], ...input };
    data.entries[index] = entry;
    checkBudgetAmounts(data);
    return entry;
  });
  res.json(UpdateBudgetEntryResponse.parse(result));
});

router.delete("/budget/entries/:id", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { id } = DeleteBudgetEntryParams.parse(req.params);
  await editWorkspace(workspace.id, (data) => {
    const index = data.entries.findIndex((e) => e.id === id);
    if (index < 0) throw new HttpError(404, "Budget entry not found in your workspace.");
    data.entries.splice(index, 1);
  });
  res.sendStatus(204);
});

export default router;
