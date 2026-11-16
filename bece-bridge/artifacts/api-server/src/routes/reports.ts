import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, bridgeAdmins, bridgeReports, bridgeReportReviews, bridgeResources } from "@workspace/db";
import {
  CreateResourceReportBody, CreateResourceReportParams, CreateResourceReportResponse,
  ListMyReportsResponse, ListAdminReportsResponse, ReviewResourceReportBody,
  ReviewResourceReportParams, ReviewResourceReportResponse,
} from "@workspace/api-zod";
import { rateLimit, sameOriginWrite } from "../lib/bridge-limits";

function publicReport(row: typeof bridgeReports.$inferSelect) {
  const { visitorId: _privateId, ownerUserId: _privateOwner, ...report } = row;
  return { ...report, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export const studentReports: IRouter = Router();
studentReports.post("/bridge/resources/:id/reports", async (req, res): Promise<void> => {
  const params = CreateResourceReportParams.safeParse(req.params);
  const body = CreateResourceReportBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.details.trim().length < 10) {
    res.status(400).json({ error: "Choose an issue and describe it in 10–4,000 characters." }); return;
  }
  const [resource] = await db.select().from(bridgeResources).where(and(
    eq(bridgeResources.id, params.data.id),
    or(and(eq(bridgeResources.visitorId, res.locals.visitorId), isNull(bridgeResources.ownerUserId)), req.user ? eq(bridgeResources.ownerUserId, req.user.id) : undefined),
  ));
  if (!resource) { res.status(404).json({ error: "Resource not found for this browser." }); return; }
  const [report] = await db.insert(bridgeReports).values({
    id: randomUUID(), visitorId: res.locals.visitorId, ownerUserId: resource.ownerUserId, resourceId: resource.id,
    // Each resource is the persisted output of exactly one generation, including legacy outputs.
    generationId: resource.id, courseId: String(resource.resource.courseId ?? "210"),
    topic: String(resource.resource.topic ?? ""), resourceTitle: String(resource.resource.title ?? ""),
    category: body.data.category, details: body.data.details.trim(),
  }).returning();
  res.status(201).json(CreateResourceReportResponse.parse(publicReport(report!)));
});
studentReports.get("/bridge/reports", async (req, res): Promise<void> => {
  const reports = await db.select().from(bridgeReports).where(or(
    and(eq(bridgeReports.visitorId, res.locals.visitorId), isNull(bridgeReports.ownerUserId)),
    req.user ? eq(bridgeReports.ownerUserId, req.user.id) : undefined,
  )).orderBy(desc(bridgeReports.createdAt));
  res.json(ListMyReportsResponse.parse(reports.map(publicReport)));
});

const router: IRouter = Router();
router.use("/admin", sameOriginWrite, rateLimit, async (req, res, next): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in to review reports." }); return; }
  const [admin] = await db.select().from(bridgeAdmins).where(eq(bridgeAdmins.userId, req.user.id));
  if (!admin) { res.status(403).json({ error: "Your account has not been granted administrator access." }); return; }
  next();
});
router.get("/admin/reports", async (_req, res): Promise<void> => {
  const reports = await db.select().from(bridgeReports).orderBy(desc(bridgeReports.createdAt)).limit(200);
  res.json(ListAdminReportsResponse.parse(reports.map(publicReport)));
});
router.patch("/admin/reports/:id", async (req, res): Promise<void> => {
  const params = ReviewResourceReportParams.safeParse(req.params);
  const body = ReviewResourceReportBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.reviewNote.trim()) {
    res.status(400).json({ error: "Provide a valid status, version, and review note." }); return;
  }
  const updated = await db.transaction(async tx => {
    const [row] = await tx.update(bridgeReports).set({
      status: body.data.status, reviewNote: body.data.reviewNote.trim(),
      version: body.data.version + 1, updatedAt: new Date(),
    }).where(and(eq(bridgeReports.id, params.data.id), eq(bridgeReports.version, body.data.version))).returning();
    if (!row) return null;
    await tx.insert(bridgeReportReviews).values({
      id: randomUUID(), reportId: row.id, reviewerId: req.user!.id,
      change: { status: row.status, reviewNote: row.reviewNote, version: row.version },
    });
    return row;
  });
  if (!updated) { res.status(409).json({ error: "This report changed or is unavailable. Refresh before reviewing." }); return; }
  res.json(ReviewResourceReportResponse.parse(publicReport(updated)));
});
export default router;
