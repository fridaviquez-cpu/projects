/** Citation checks validate provenance, not whether the cited passage proves a claim. */
export function tutorSourceMode(resource: { sourceMode?: unknown; materialIds?: unknown; disclaimer?: unknown }) {
  if (resource.sourceMode === "library" || resource.sourceMode === "combined" || resource.sourceMode === "materials") return resource.sourceMode;
  // Legacy explicit mode survives in the saved disclaimer. Otherwise fail closed.
  if (typeof resource.disclaimer === "string" && resource.disclaimer.startsWith("Source mode: combined.")) return "combined";
  return Array.isArray(resource.materialIds) && resource.materialIds.length ? "materials" : "library";
}

export function normalizeTutorLabel(label: string) {
  return label.trim().replace(/^\[((?:M[a-zA-Z0-9-]+-P\d+-S\d+)|B\d+|S-[a-z0-9-]+)\]$/, "$1");
}

export function assertTutorCitations(reply: { answer: string; supported: boolean; citations: string[] }, evidence: { label: string; url: string }[]) {
  const labels = [...reply.answer.matchAll(/\[([^\]\n]+)\]/g)]
    .filter(m => /\b(?:M[a-z0-9-]+-P|B\d|S-)/i.test(m[1]!))
    .flatMap(m => m[1]!.split(/[,;]/).map(s => s.trim()));
  if (reply.supported && (!reply.citations.length || !labels.length ||
    [...reply.citations, ...labels].some(c => !evidence.some(e => e.label === c)) ||
    labels.some(c => !reply.citations.includes(c)) || reply.citations.some(c => !labels.includes(c)))) {
    throw new Error("Invalid citation");
  }
  if (!reply.supported && (reply.citations.length || labels.length)) throw new Error("Unsupported citation");
  // Never let a generated source link masquerade as a retrieved reference.
  for (const match of reply.answer.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (!evidence.some(e => e.url === match[1])) throw new Error("Unretrieved link");
  }
}

export function materialCitationPrefix(id: string, ids: string[], sources: { kind: string; url: string }[]) {
  const existing = sources.find(s => s.url.startsWith(`/materials/${id}#`))?.kind.match(/\[(M[a-zA-Z0-9-]+)-P\d+-S\d+\]/)?.[1];
  if (existing) return existing;
  // Selected documents not retrieved on the original turn must not collide with its labels.
  const max = Math.max(0, ...sources.map(s => Number(s.kind.match(/M(\d+)/)?.[1] ?? 0)));
  return `M${max + ids.indexOf(id) + 1}`;
}
