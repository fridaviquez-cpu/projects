import { db, bridgeMaterials, bridgeResources, bridgeVisuals } from "@workspace/db";
import { and, eq, arrayContains } from "drizzle-orm";
import { EvidenceError } from "./evidence-context";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// All source-dependent writes lock the same rows as deletion, in stable order.
export async function withMaterialLocks<T>(ids: string[], owner: string | undefined, course: string, write: (tx: Transaction) => Promise<T>) {
  return db.transaction(async tx => {
    for (const id of [...new Set(ids)].sort()) {
      const [material] = await tx.select().from(bridgeMaterials)
        .where(and(eq(bridgeMaterials.id, id), eq(bridgeMaterials.ownerId, owner ?? ""), eq(bridgeMaterials.courseId, course))).for("update");
      if (!material) throw new EvidenceError(410, "A source was deleted or is no longer available. The response was not saved.");
    }
    return write(tx);
  });
}

export async function deleteMaterialRecords(id: string, owner: string, course: string) {
  return withMaterialLocks([id], owner, course, async tx => {
    const drafts = await tx.select().from(bridgeResources).where(eq(bridgeResources.ownerUserId, owner));
    for (const draft of drafts) {
      if ((draft.resource.materialIds as string[] | undefined)?.includes(id)) {
        await tx.delete(bridgeResources).where(eq(bridgeResources.id, draft.id));
      }
    }
    await tx.delete(bridgeVisuals).where(arrayContains(bridgeVisuals.materialIds, [id]));
    await tx.delete(bridgeMaterials).where(eq(bridgeMaterials.id, id));
  });
}
