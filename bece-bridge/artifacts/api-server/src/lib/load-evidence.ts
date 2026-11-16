import { db, bridgeMaterials } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { retrieveEvidence, type EvidenceRequest } from "./evidence-context";

export function loadEvidence(input: EvidenceRequest, query: string, ownerId?: string) {
  return retrieveEvidence(input, query, ownerId, (owner, course) =>
    db.select().from(bridgeMaterials).where(and(eq(bridgeMaterials.ownerId, owner), eq(bridgeMaterials.courseId, course))));
}
