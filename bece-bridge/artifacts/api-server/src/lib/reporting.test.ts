import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, bridgeVisitors, bridgeResources, bridgeReports, bridgeReportReviews, bridgeAdmins, bridgeGenerationUsage, bridgeRateBuckets, bridgeAssessments, usersTable, sessionsTable } from "@workspace/db";
import app from "../app";
import { createSession } from "./auth";
import { consumeRate, reserveGeneration, releaseGeneration } from "./bridge-limits";
import { GenerateResourceResponse, CreateResourceReportResponse, ListAdminReportsResponse, ListMyReportsResponse, ListResourcesResponse, StartAssessmentResponse, GetJourneyResponse } from "@workspace/api-zod";
import { bridgePilotCourses } from "@workspace/db";

test("resource reporting, review isolation, guest bootstrap and durable quota", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const users = [randomUUID(), randomUUID()];
  const guests: string[] = [];
  const sessions: string[] = [];
  const reportIds: string[] = [];
  const key = `test:${randomUUID()}`;
  let insertedPilot = false;
  async function request(path: string, method = "GET", cookie = "", body?: unknown, csrf = true) {
    return fetch(base + path, {
      method, headers: { Cookie: cookie, ...(csrf ? { "X-Bridge-Request": "1" } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  async function guest() {
    const response = await request("/bridge/session", "POST");
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    guests.push(cookie.split("=")[1]!);
    return cookie;
  }
  try {
    insertedPilot = (await db.insert(bridgePilotCourses).values({ courseId: "210", isPilot: true }).onConflictDoNothing().returning()).length > 0;
    const noGuest = await request("/bridge/journey");
    assert.equal(noGuest.status, 428);
    assert.equal(noGuest.headers.get("set-cookie"), null);
    const catalog = await request("/bridge/courses");
    assert.equal(catalog.status, 200);
    assert.equal(catalog.headers.get("set-cookie"), null);
    assert.equal((await request("/bridge/session", "POST", "", undefined, false)).status, 403);
    const a = await guest(), b = await guest();
    assert.equal((await request("/bridge/session", "POST", a)).headers.get("set-cookie"), null);
    const resourceResponse = await request("/bridge/resources", "POST", a, { kind: "practice-exam", courseId: "210", topic: "pilot fundamentals" });
    assert.equal(resourceResponse.status, 200);
    const resource = GenerateResourceResponse.parse(await resourceResponse.json());
    const originalContent = resource.content;
    const reportPath = `/bridge/resources/${resource.id}/reports`;
    assert.equal((await request(reportPath, "POST", b, { category: "solution", details: "Another student's resource" })).status, 404);
    assert.equal((await request(reportPath, "POST", a, { category: "other", details: "Invalid category test" })).status, 400);
    assert.equal((await request(reportPath, "POST", a, { category: "solution", details: "          " })).status, 400);
    const created = await request(reportPath, "POST", a, {
      category: "solution", details: "Please check problem 1's units.", courseId: "999", topic: "forged", generationId: "forged", status: "resolved",
    });
    assert.equal(created.status, 201);
    const rawReport = await created.json() as Record<string, unknown>;
    assert(!("visitorId" in rawReport));
    const report = CreateResourceReportResponse.parse(rawReport);
    reportIds.push(report.id);
    assert.equal(report.courseId, "210");
    assert.equal(report.topic, "pilot fundamentals");
    assert.equal(report.generationId, resource.id);
    assert.equal(report.status, "open");
    assert(!("visitorId" in report));
    assert.deepEqual(await (await request("/bridge/reports", "GET", b)).json(), []);
    assert.equal((await request("/admin/reports")).status, 401);
    for (const id of users) {
      await db.insert(usersTable).values({ id });
      sessions.push(await createSession({ user: { id, email: null, firstName: null, lastName: null, profileImageUrl: null }, access_token: "test-only", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
    }
    const normal = `sid=${sessions[0]}`, admin = `sid=${sessions[1]}`;
    const privateId = randomUUID();
    await db.insert(bridgeResources).values({
      id: privateId, visitorId: guests[0]!, ownerUserId: users[0]!,
      resource: { ...resource, id: privateId, topic: "private topic", materialIds: [] },
    });
    const privatePath = `/bridge/resources/${privateId}/reports`;
    const privateBody = { category: "solution", details: "Private report test details." };
    assert.equal((await request(privatePath, "POST", a, privateBody)).status, 404, "guest cookie must not authorize account-owned drafts");
    assert.equal((await request(privatePath, "POST", `${a}; ${admin}`, privateBody)).status, 404, "another account in the same browser must not report private drafts");
    const privateReportResponse = await request(privatePath, "POST", `${b}; ${normal}`, privateBody);
    assert.equal(privateReportResponse.status, 201, "owner can report a private draft from another browser");
    const privateReport = CreateResourceReportResponse.parse(await privateReportResponse.json());
    reportIds.push(privateReport.id);
    assert.deepEqual(await (await request("/bridge/reports", "GET", b)).json(), [], "logging out must hide account-owned reports");
    const ownerReports = ListMyReportsResponse.parse(await (await request("/bridge/reports", "GET", `${a}; ${normal}`)).json());
    assert(ownerReports.some(r => r.id === privateReport.id));
    assert.equal((await request("/admin/reports", "GET", normal)).status, 403);
    await db.insert(bridgeAdmins).values({ userId: users[1]! });
    const adminList = await request("/admin/reports", "GET", admin);
    assert.equal(adminList.status, 200);
    assert.equal(adminList.headers.get("cache-control"), "no-store");
    const rawList = await adminList.json() as Record<string, unknown>[];
    assert(rawList.every(r => !("visitorId" in r) && !("content" in r)));
    const listed = ListAdminReportsResponse.parse(rawList).find(r => r.id === report.id);
    assert(listed && !("content" in listed) && !("visitorId" in listed));
    const reviewPath = `/admin/reports/${report.id}`;
    const reviewBody = { status: "resolved", reviewNote: "Reviewed; the equation needs a separate content correction.", version: 0 };
    assert.equal((await request(reviewPath, "PATCH", normal, reviewBody)).status, 403);
    assert.equal((await request(reviewPath, "PATCH", admin, reviewBody, false)).status, 403);
    assert.equal((await request(reviewPath, "PATCH", admin, { ...reviewBody, reviewNote: " " })).status, 400);
    assert.equal((await request(reviewPath, "PATCH", admin, reviewBody)).status, 200);
    assert.equal((await request(reviewPath, "PATCH", admin, reviewBody)).status, 409);
    const ownReports = ListMyReportsResponse.parse(await (await request("/bridge/reports", "GET", a)).json());
    assert.equal(ownReports[0].status, "resolved");
    assert.equal(ownReports[0].version, 1);
    const audit = await db.select().from(bridgeReportReviews).where(eq(bridgeReportReviews.reportId, report.id));
    assert.equal(audit.length, 1);
    assert.equal(audit[0]!.reviewerId, users[1]);
    const resources = ListResourcesResponse.parse(await (await request("/bridge/resources", "GET", a)).json());
    assert.equal(resources.find(r => r.id === resource.id)!.content, originalContent);
    assert(!resources.some(r => r.id === privateId));
    assert.equal((await request(`/bridge/resources/${resource.id}`, "DELETE", b)).status, 404);
    assert.equal((await request(`/bridge/resources/${resource.id}`, "DELETE", a)).status, 204);
    assert.equal(ListMyReportsResponse.parse(await (await request("/bridge/reports", "GET", a)).json())[0]!.resourceId, resource.id);
    const [usage] = await db.select().from(bridgeGenerationUsage).where(eq(bridgeGenerationUsage.visitorId, guests[0]!));
    assert.equal(usage!.count, 1, "deleting a resource must not refund usage");
    await db.update(bridgeGenerationUsage).set({ count: 19 }).where(eq(bridgeGenerationUsage.visitorId, guests[0]!));
    const reservations = await Promise.all([reserveGeneration(guests[0]!), reserveGeneration(guests[0]!)]);
    const successes = reservations.filter(r => r.leaseId);
    assert.equal(successes.length, 1, "only one concurrent generation may reserve quota");
    await releaseGeneration(guests[0]!, successes[0]!.leaseId!);
    const exhausted = await request("/bridge/resources", "POST", a, { kind: "practice-exam", courseId: "210", topic: "blocked" });
    assert.equal(exhausted.status, 429);
    assert(Number(exhausted.headers.get("retry-after")) > 0);
    const concurrentLimits = await Promise.all(Array.from({ length: 5 }, () => consumeRate(key, 2, 60000)));
    assert.equal(concurrentLimits.filter(r => r.allowed).length, 2);
    const assessment = StartAssessmentResponse.parse(await (await request("/bridge/assessment", "POST", a, { mode: "diagnostic" })).json());
    assert(assessment.questions.every((q: object) => !("expected" in q)));
    const answers = assessment.questions.map((q: { id: string }) => ({ questionId: q.id, value: 0 }));
    assert.equal((await request("/bridge/assessment/submit", "POST", b, { assessmentId: assessment.id, answers })).status, 404);
    assert.equal((await request("/bridge/assessment/submit", "POST", a, { assessmentId: assessment.id, answers })).status, 200);
    assert.equal(GetJourneyResponse.parse(await (await request("/bridge/journey", "GET", a)).json()).attempts.length, 1);
    await db.delete(bridgeAdmins).where(eq(bridgeAdmins.userId, users[1]!));
    assert.equal((await request("/admin/reports", "GET", admin)).status, 403, "revocation applies to an existing signed-in session");
  } finally {
    await db.delete(bridgeReportReviews).where(inArray(bridgeReportReviews.reportId, reportIds));
    await db.delete(bridgeReports).where(inArray(bridgeReports.visitorId, guests));
    await db.delete(bridgeResources).where(inArray(bridgeResources.visitorId, guests));
    await db.delete(bridgeAssessments).where(inArray(bridgeAssessments.visitorId, guests));
    await db.delete(bridgeGenerationUsage).where(inArray(bridgeGenerationUsage.visitorId, guests));
    await db.delete(bridgeVisitors).where(inArray(bridgeVisitors.id, guests));
    await db.delete(bridgeAdmins).where(inArray(bridgeAdmins.userId, users));
    await db.delete(sessionsTable).where(inArray(sessionsTable.sid, sessions));
    await db.delete(usersTable).where(inArray(usersTable.id, users));
    await db.delete(bridgeRateBuckets).where(eq(bridgeRateBuckets.key, `${key}:${Math.floor(Date.now() / 60000)}`));
    if (insertedPilot) await db.delete(bridgePilotCourses).where(eq(bridgePilotCourses.courseId, "210"));
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await pool.end();
  }
});
