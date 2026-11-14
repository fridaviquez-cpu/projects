import { randomBytes, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, portfolioWorkspaces } from "@workspace/db";
import { UpdatePreferencesBody, RestoreWorkspaceBody, CreateRecoveryKeyResponse } from "@workspace/api-zod";
import { bootstrapWorkspace, editWorkspace, hashSecret, HttpError, issueSession, publicWorkspace, requireWorkspace } from "../../lib/portfolio-store";
import { portfolioSummary } from "../../lib/portfolio-summary";

const router: IRouter = Router();
const entryLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false,
  message: { error: "Too many workspace requests. Try again in a few minutes." },
});
const recoveryLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false,
  message: { error: "Too many recovery attempts. Wait 15 minutes before trying again." },
});

router.get("/workspace", entryLimit, async (req, res): Promise<void> => {
  res.json(publicWorkspace(await bootstrapWorkspace(req, res)));
});

router.patch("/workspace", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const input = UpdatePreferencesBody.parse(req.body);
  const { workspace: updated } = await editWorkspace(workspace.id, (data) => {
    data.name = input.name.trim();
    data.experience = input.experience;
    data.goal = input.goal.trim();
  });
  res.json(publicWorkspace(updated));
});

router.post("/workspace/recovery", recoveryLimit, async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const key = `piq_${randomBytes(32).toString("base64url")}`;
  await db.update(portfolioWorkspaces).set({ recoveryHash: hashSecret(key), updatedAt: new Date() })
    .where(eq(portfolioWorkspaces.id, workspace.id));
  res.json(CreateRecoveryKeyResponse.parse({ key }));
});

router.post("/workspace/restore", recoveryLimit, async (req, res): Promise<void> => {
  const input = RestoreWorkspaceBody.parse(req.body);
  const key = input.key.trim();
  if (!/^piq_[A-Za-z0-9_-]{43}$/.test(key)) throw new HttpError(400, "That recovery key is not valid. Check the entire key and try again.");
  const [workspace] = await db.select().from(portfolioWorkspaces)
    .where(eq(portfolioWorkspaces.recoveryHash, hashSecret(key))).limit(1);
  if (!workspace) throw new HttpError(400, "That recovery key is not valid. Check the entire key and try again.");
  await issueSession(req, res, workspace.id);
  res.json(publicWorkspace(workspace));
});

router.post("/workspace/sample", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  const { workspace: updated } = await editWorkspace(workspace.id, (data) => {
    if (data.holdings.length > 0) throw new HttpError(409, "Sample holdings can only be added to an empty portfolio. Your holdings have not been changed.");
    const updatedAt = new Date().toISOString();
    const priceDate = "2026-11-06";
    const notes = "Illustrative sample — not live prices. Edit or delete this holding to make it your own.";
    data.holdings.push(
      { id: randomUUID(), symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", quantity: 40, priceCents: 28000, costBasisCents: 1000000, priceDate, notes, isSample: true, updatedAt },
      { id: randomUUID(), symbol: "AAPL", name: "Apple Inc.", type: "Stock", quantity: 15, priceCents: 22500, costBasisCents: 290000, priceDate, notes, isSample: true, updatedAt },
      { id: randomUUID(), symbol: "SPAXX", name: "Fidelity Government Money Market", type: "Cash", quantity: 745, priceCents: 100, costBasisCents: 74500, priceDate, notes, isSample: true, updatedAt },
    );
    if (data.theses.length === 0) data.theses.push({
      id: randomUUID(), symbol: "VTI", title: "Own the market, not the headlines",
      reasoning: "Illustrative sample: broad US equity exposure can reduce dependence on any one company. My horizon would need to accommodate market downturns.",
      risks: "US-only exposure, equity drawdowns, and uncertainty about future returns.",
      status: "Researching", createdAt: updatedAt, updatedAt,
    });
  });
  res.json(publicWorkspace(updated));
});

router.get("/overview", async (req, res): Promise<void> => {
  const workspace = await requireWorkspace(req);
  res.json(portfolioSummary(workspace.data));
});

export default router;
