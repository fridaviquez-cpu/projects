import { sharedStudy, sharedLicense, permissionUrl, checkedAt } from "../data/shared-study";

export function courseStudy(courseId: string) {
  return sharedStudy.filter(s => s.courses.includes(courseId)).map(s => ({
    ...s, license: "CC BY-SA 4.0", licenseUrl: sharedLicense, permissionUrl, checkedAt,
    attribution: `Wikibooks contributors — ${s.title}`,
  }));
}

// Deliberately conservative, topic-gated retrieval: never fill empty results
// with unrelated excerpts, and never search outside the selected course.
export function retrieveSharedStudy(courseId: string, query: string) {
  const normalized = ` ${query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  return courseStudy(courseId).map(s => ({
    ...s, score: s.keywords.reduce((n, key) => n + (normalized.includes(` ${key} `) ? 1 : 0), 0),
  })).filter(s => s.score > 0).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id))
    .slice(0,4).map(s => ({
      ...s, label: `S-${s.id}`, title: `${s.title} · ${s.locator}`,
      text: `${s.text}\nEditorial changes and limits: ${s.changes}`,
    }));
}

export function validateEvidenceCitations(content: string, evidence: {label: string}[]) {
  const labels = [...content.matchAll(/\[((?:M[a-zA-Z0-9-]+-P\d+-S\d+)|(?:S-[a-z0-9-]+))\]/g)].map(m => m[1]);
  if (!labels.length || labels.some(label => !evidence.some(s => s.label === label))) {
    throw new Error("Missing or invalid source citations");
  }
  return new Set(labels);
}

export function sharedAttribution(evidence: ReturnType<typeof retrieveSharedStudy>) {
  if (!evidence.length) return "";
  return "\n\n## Shared material attribution and license\nThis draft's shared-source adaptations and reproduced excerpts are available under [CC BY-SA 4.0]("+sharedLicense+"). AI-generated adaptations are not reviewed by the source authors. Private uploads, if present, retain their own rights and are not relicensed.\n\n"+
    evidence.map(s => `- ${s.attribution}: [source page](${s.url}), [version consulted](${s.revisionUrl}); ${s.locator}. Checked ${checkedAt.slice(0,10)}. Changes: ${s.changes}`).join("\n");
}
