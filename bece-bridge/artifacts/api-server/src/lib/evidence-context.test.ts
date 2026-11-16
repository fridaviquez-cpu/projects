import assert from "node:assert/strict";
import { retrieveEvidence, EvidenceError, rankExcerpts, type EvidenceMaterial } from "./evidence-context";
import { GenerateResourceBody, GenerateVisualBody, UploadMaterialBody } from "@workspace/api-zod";
import { withPilotMembership } from "./pilot-membership";

const materials: EvidenceMaterial[] = [
  { id: "rc-210", ownerId: "alice", courseId: "210", title: "RC transient notes",
    pages: [{ page: 4, text: "RC charging: Vc(t)=5*(1-exp(-t/0.002)) volts. R=2000 ohms, C=1 microfarad, tau=RC=0.002 seconds. At t=tau, Vc=3.1606 volts." }] },
  { id: "prob-313", ownerId: "alice", courseId: "313", title: "Binomial lecture",
    pages: [{ page: 7, text: "Binomial probability for n=4 and p=0.25: P(X=2)=6*(0.25^2)*(0.75^2)=0.2109375. Mean np=1 and variance np(1-p)=0.75." }] },
  { id: "other", ownerId: "bob", courseId: "210", title: "Private Bob", pages: [{ page: 2, text: "Secret RC lecture." }] },
];
const loader = async () => materials; // Deliberately unscoped to exercise defense in depth.
const input = { courseId: "210", materialIds: ["rc-210"], sourceMode: "materials" as const, processingConsent: true };
async function rejects(status: number, operation: Promise<unknown>) {
  await assert.rejects(operation, e => e instanceof EvidenceError && e.status === status);
}
for (const [courseId, id, query, page, numeric] of [
  ["210", "rc-210", "RC charging tau", 4, "3.1606"],
  ["313", "prob-313", "Binomial probability variance", 7, "0.2109375"],
] as const) {
  const text = await retrieveEvidence({ ...input, courseId, materialIds: [id] }, query, "alice", loader);
  const visual = await retrieveEvidence({ ...input, courseId, materialIds: [id], sourceMode: "combined" }, query, "alice", loader);
  assert.deepEqual(text.excerpts, visual.excerpts);
  assert.equal(text.excerpts[0]?.page, page);
  assert.ok(text.excerpts[0]?.text.includes(numeric));
  assert.equal(text.sources[0]?.url, `/materials/${id}#page-${page}`);
  assert.ok(text.sources[0]?.kind.includes(text.excerpts[0]!.label));
}
await rejects(401, retrieveEvidence(input, "RC", undefined, loader));
await rejects(400, retrieveEvidence({ ...input, processingConsent: false }, "RC", "alice", loader));
await rejects(400, retrieveEvidence({ ...input, materialIds: [] }, "RC", "alice", loader));
await rejects(404, retrieveEvidence({ ...input, materialIds: ["other"] }, "RC", "alice", loader));
await rejects(404, retrieveEvidence({ ...input, materialIds: ["prob-313"] }, "probability", "alice", loader));
await rejects(404, retrieveEvidence(input, "RC", "bob", loader));
await rejects(404, retrieveEvidence(input, "RC", "alice", async () => [])); // Deleted.
await rejects(422, retrieveEvidence(input, "semiconductor doping", "alice", loader));
await rejects(422, retrieveEvidence(input, "charging", "alice", async () => [{ ...materials[0]!, pages: [] }]));
await assert.rejects(retrieveEvidence(input, "charging", "alice", async () => { throw Error("Database unavailable"); }), /Database unavailable/);
const library = await retrieveEvidence({ ...input, sourceMode: "library" }, "RC", undefined, async () => { throw Error("Must not read private sources"); });
assert.equal(library.excerpts.length, 0);
assert.equal(library.materialIds.length, 0);
const forward = rankExcerpts(materials.slice(0, 2), "probability");
const reverse = rankExcerpts(materials.slice(0, 2).reverse(), "probability");
assert.deepEqual(forward, reverse, "Citation IDs cannot depend on selected-source order");
assert.ok(rankExcerpts([{ ...materials[0]!, pages: [{ page: 9, text: "charging ".repeat(3000) }] }], "charging").length <= 8);
// A newly enabled catalog pilot must not be blocked by generated request enums.
assert.ok(GenerateResourceBody.safeParse({ courseId: "391", kind: "explanation", topic: "probability" }).success);
assert.ok(GenerateVisualBody.safeParse({ courseId: "391", prompt: "Plot probability", sourceMode: "materials" }).success);
assert.ok(UploadMaterialBody.shape.courseId.safeParse("391").success);
assert.deepEqual(withPilotMembership([{id:"210"},{id:"313"},{id:"391"}], [
  {courseId:"210",isPilot:false}, {courseId:"313",isPilot:true}, {courseId:"391",isPilot:true},
]).filter(c => c.isPilot).map(c => c.id), ["313","391"], "Disabling a seeded pilot and enabling a new catalog course must take effect");
console.log("Evidence contract: quantitative ECE210/ECE313, stable pages, isolation, consent, deletion, missing evidence, bounds and dynamic request eligibility passed.");
