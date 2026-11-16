import { createHmac, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, bridgeRateBuckets, bridgeGenerationUsage, bridgeResources } from "@workspace/db";

export function sameOriginWrite(req: Request, res: Response, next: NextFunction) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("X-Bridge-Request") !== "1") {
    res.status(403).json({ error: "Use the application to submit this request." });
    return;
  }
  next();
}

export async function consumeRate(key: string, maximum: number, milliseconds: number) {
  const bucket = Math.floor(Date.now() / milliseconds);
  const expiresAt = new Date((bucket + 1) * milliseconds);
  const [row] = await db.insert(bridgeRateBuckets).values({ key: `${key}:${bucket}`, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: bridgeRateBuckets.key,
      set: { count: sql`${bridgeRateBuckets.count} + 1` },
      setWhere: lt(bridgeRateBuckets.count, maximum),
    }).returning();
  // Expired buckets no longer participate; remove them to bound table growth.
  await db.delete(bridgeRateBuckets).where(lt(bridgeRateBuckets.expiresAt, new Date()));
  return { allowed: !!row, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)) };
}

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  // A keyed digest avoids storing client network addresses. Fail closed if unconfigured.
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(503).json({ error: "Request protection is not configured." }); return; }
  const network = createHmac("sha256", secret).update(req.ip ?? "unknown").digest("hex");
  const limit = await consumeRate(`network:${network}`, 60, 60000);
  if (!limit.allowed) {
    res.setHeader("Retry-After", limit.retryAfter);
    res.status(429).json({ error: "Too many requests. Please wait a minute." });
    return;
  }
  if (req.method === "POST" && (["/resources", "/visuals", "/visuals/"].includes(req.path) || /^\/resources\/[^/]+\/conversation$/.test(req.path))) {
    const daily = await consumeRate(`generation-network:${network}`, 60, 86400000);
    if (!daily.allowed) {
      res.setHeader("Retry-After", daily.retryAfter);
      res.status(429).json({ error: "The daily generation-attempt limit for this network has been reached. Try again tomorrow." });
      return;
    }
  }
  next();
}

export async function reserveGeneration(visitorId: string) {
  return db.transaction(async tx => {
    // Seed current-day historic usage on first rollout, without touching resources.
    const today = new Date().toISOString().slice(0, 10);
    const [historic] = await tx.select({ count: sql<number>`count(*)::int` }).from(bridgeResources)
      .where(and(eq(bridgeResources.visitorId, visitorId), sql`${bridgeResources.createdAt} >= ${`${today}T00:00:00Z`}::timestamptz`));
    await tx.insert(bridgeGenerationUsage).values({ visitorId, day: today, count: historic?.count ?? 0 }).onConflictDoNothing();
    const [usage] = await tx.select().from(bridgeGenerationUsage).where(eq(bridgeGenerationUsage.visitorId, visitorId)).for("update");
    const now = new Date();
    if (usage!.leaseUntil && usage!.leaseUntil > now) return { error: "A resource is already being generated. Please wait.", retryAfter: 120 } as const;
    const count = usage!.day === today ? usage!.count : 0;
    if (count >= 20) return { error: "This pilot allows 20 generation attempts per browser per UTC day. Deleting resources does not reset usage.", retryAfter: Math.ceil((Date.parse(`${today}T00:00:00Z`) + 86400000 - now.getTime()) / 1000) } as const;
    const leaseId = randomUUID();
    await tx.update(bridgeGenerationUsage).set({ day: today, count: count + 1, leaseId, leaseUntil: new Date(now.getTime() + 180000) }).where(eq(bridgeGenerationUsage.visitorId, visitorId));
    return { leaseId } as const;
  });
}

export async function releaseGeneration(visitorId: string, leaseId: string) {
  await db.update(bridgeGenerationUsage).set({ leaseUntil: null, leaseId: null })
    .where(and(eq(bridgeGenerationUsage.visitorId, visitorId), eq(bridgeGenerationUsage.leaseId, leaseId)));
}
