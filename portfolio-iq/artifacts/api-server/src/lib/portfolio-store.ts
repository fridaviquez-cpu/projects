import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, portfolioWorkspaces, portfolioSessions, type PortfolioData, type PortfolioWorkspace } from "@workspace/db";
import { GetWorkspaceResponse } from "@workspace/api-zod";

const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 365;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const hashSecret = (token: string) => createHash("sha256").update(token).digest("hex");

export function emptyPortfolio(): PortfolioData {
  return { name: "", experience: "Beginner", goal: "", holdings: [], theses: [], entries: [], budgetLimits: {}, progress: {} };
}

function cookieOptions(req: Request) {
  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_LIFETIME };
}

function cookieName(req: Request) {
  return cookieOptions(req).secure ? "__Host-piq_guest" : "piq_guest";
}

function readToken(req: Request): string | undefined {
  const token = req.cookies?.[cookieName(req)];
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

export async function findWorkspace(req: Request): Promise<PortfolioWorkspace | undefined> {
  const token = readToken(req);
  if (!token) return undefined;
  const [result] = await db.select({ workspace: portfolioWorkspaces }).from(portfolioSessions)
    .innerJoin(portfolioWorkspaces, eq(portfolioWorkspaces.id, portfolioSessions.workspaceId))
    .where(and(eq(portfolioSessions.tokenHash, hashSecret(token)), gt(portfolioSessions.expiresAt, new Date())))
    .limit(1);
  return result?.workspace;
}

export async function requireWorkspace(req: Request): Promise<PortfolioWorkspace> {
  const workspace = await findWorkspace(req);
  if (!workspace) throw new HttpError(401, "Your private workspace session is unavailable. Reload to reconnect, or use your recovery key in Settings.");
  return workspace;
}

export async function issueSession(req: Request, res: Response, workspaceId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db.insert(portfolioSessions).values({
    tokenHash: hashSecret(token), workspaceId, expiresAt: new Date(Date.now() + SESSION_LIFETIME),
  });
  res.cookie(cookieName(req), token, cookieOptions(req));
}

export async function bootstrapWorkspace(req: Request, res: Response): Promise<PortfolioWorkspace> {
  const existing = await findWorkspace(req);
  if (existing) {
    const token = readToken(req)!;
    await db.update(portfolioSessions).set({ expiresAt: new Date(Date.now() + SESSION_LIFETIME) })
      .where(eq(portfolioSessions.tokenHash, hashSecret(token)));
    res.cookie(cookieName(req), token, cookieOptions(req));
    return existing;
  }
  // Cookie and session are established by this one bootstrap request before child queries run.
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(portfolioWorkspaces).values({ data: emptyPortfolio() }).returning();
    const token = randomBytes(32).toString("hex");
    await tx.insert(portfolioSessions).values({
      tokenHash: hashSecret(token), workspaceId: row.id, expiresAt: new Date(Date.now() + SESSION_LIFETIME),
    });
    return { row, token };
  });
  res.cookie(cookieName(req), created.token, cookieOptions(req));
  return created.row;
}

export function publicWorkspace(row: PortfolioWorkspace) {
  return GetWorkspaceResponse.parse({
    ...row.data, id: row.id, hasRecoveryKey: row.recoveryHash !== null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  });
}

// Serialize document edits on the workspace row so separate tabs never overwrite unrelated edits.
export async function editWorkspace<T>(
  id: string,
  edit: (data: PortfolioData) => T,
): Promise<{ result: T; workspace: PortfolioWorkspace }> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(portfolioWorkspaces).where(eq(portfolioWorkspaces.id, id)).for("update");
    if (!row) throw new HttpError(404, "Workspace not found.");
    const data = structuredClone(row.data);
    const result = edit(data);
    const [updated] = await tx.update(portfolioWorkspaces)
      .set({ data, updatedAt: new Date() }).where(eq(portfolioWorkspaces.id, id)).returning();
    return { result, workspace: updated };
  });
}

export function validDate(date: string): void {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, "Enter a real calendar date.");
  }
}

export function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new HttpError(400, `${label} cannot be blank.`);
  return trimmed;
}
