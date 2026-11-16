import { Router, type Request } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, bridgeVisuals, type SavedVisualRow } from "@workspace/db";
import { UpdateSavedVisualBody, ListSavedVisualsResponse, UpdateSavedVisualResponse } from "@workspace/api-zod";
import { calculateVisual } from "../lib/visual-models";
import { calculateRecipe } from "../lib/visual-recipes";
import { visualVersion } from "../lib/visual-version";

export const savedVisualsRouter = Router();
function owner(req: Request, visitorId: string) {
  return req.user ? eq(bridgeVisuals.ownerUserId, req.user.id)
    : and(isNull(bridgeVisuals.ownerUserId), eq(bridgeVisuals.visitorId, visitorId));
}
function view(row: SavedVisualRow) {
  return { ...row, createdAt: row.createdAt.toISOString(),
    compatible: row.modelVersion === visualVersion(String(row.result.model)) };
}
savedVisualsRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
savedVisualsRouter.get("/", async (req, res) => {
  const rows = await db.select().from(bridgeVisuals).where(owner(req, res.locals.visitorId)).orderBy(desc(bridgeVisuals.createdAt));
  res.json(ListSavedVisualsResponse.parse(rows.map(view)));
});
savedVisualsRouter.patch("/:id", async (req, res) => {
  const parsed = UpdateSavedVisualBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Provide numeric parameters." }); return; }
  const where = and(eq(bridgeVisuals.id, String(req.params.id)), owner(req, res.locals.visitorId));
  const [row] = await db.select().from(bridgeVisuals).where(where);
  if (!row) { res.status(404).json({ error: "Visual not found." }); return; }
  if (!view(row).compatible) { res.status(409).json({ error: "This model has changed. Your saved snapshot is preserved; generate a new visual to edit." }); return; }
  let result;
  try {
    const computed = row.result.model === "custom"
      ? calculateRecipe(String(row.result.courseId), row.result.recipe, parsed.data.values)
      : calculateVisual(String(row.result.courseId), String(row.result.model), parsed.data.values);
    result = { ...row.result, ...computed };
  } catch (e) { res.status(422).json({ error: e instanceof Error ? e.message : "Invalid parameters." }); return; }
  const [updated] = await db.update(bridgeVisuals).set({ result }).where(where).returning();
  if (!updated) { res.status(404).json({ error: "Visual was deleted." }); return; }
  res.json(UpdateSavedVisualResponse.parse(view(updated)));
});
savedVisualsRouter.delete("/:id", async (req, res) => {
  const rows = await db.delete(bridgeVisuals).where(and(eq(bridgeVisuals.id, String(req.params.id)), owner(req, res.locals.visitorId))).returning({ id: bridgeVisuals.id });
  if (!rows.length) { res.status(404).json({ error: "Visual not found." }); return; }
  res.status(204).end();
});
