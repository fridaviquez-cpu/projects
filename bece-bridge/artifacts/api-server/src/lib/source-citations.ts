/** Diagnostics deliberately contain no generated text, excerpts, or student input. */
export class CitationValidationError extends Error {
  constructor(
    readonly code: "missing_citations" | "invalid_citations",
    readonly citationCount: number,
    readonly invalidCount: number,
  ) {
    super(code);
    this.name = "CitationValidationError";
  }
}

/**
 * Accept individual or comma/semicolon-separated private excerpt citations.
 * Normalize groups for consistent display; never repair or invent source IDs.
 * Membership is provenance validation, not claim-entailment verification.
 */
export function validateSourceCitations(content: string, allowedLabels: readonly string[]) {
  const allowed = new Set(allowedLabels);
  const cited = new Set<string>();
  let invalidCount = 0;
  const normalized = content.replace(/\[([^\]\n]+)\]/g, (original, inner: string) => {
    // Ignore Markdown links and mathematical brackets with no source-like label.
    if (!/\b(?:M[a-z0-9-]+-P|S-)/i.test(inner)) return original;
    const labels = inner.split(/[,;]/).map(label => label.trim());
    for (const label of labels) {
      if (!/^(?:M[a-zA-Z0-9-]+-P\d+-S\d+|S-[a-z0-9-]+)$/.test(label) || !allowed.has(label)) invalidCount++;
      else cited.add(label);
    }
    return labels.map(label => `[${label}]`).join(" ");
  });
  if (invalidCount) throw new CitationValidationError("invalid_citations", cited.size, invalidCount);
  if (!cited.size) throw new CitationValidationError("missing_citations", 0, 0);
  return { content: normalized, cited: [...cited] };
}

export function citationFailureDiagnostics(error: unknown) {
  return error instanceof CitationValidationError
    ? { failureCode: error.code, citationCount: error.citationCount, invalidCitationCount: error.invalidCount }
    : { failureCode: "generation_failed" };
}
