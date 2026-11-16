import { z } from "zod";
import { normalizeTutorLabel } from "./tutor-evidence";

export const tutorReplySchema = z.object({
  answer: z.string().min(1).max(16000),
  supported: z.boolean(),
  citations: z.array(z.string().transform(normalizeTutorLabel)).max(12),
  visualPrompt: z.string().max(1100).nullish().transform(value => value ?? undefined),
});

export type TutorStage = "evidence" | "provider" | "completion" | "decode" | "shape" | "citations" | "persist";

/** Only fixed codes and schema paths leave this boundary; never log error messages
 * from a provider, JSON parser or database that could contain student content. */
export function tutorFailure(stage: TutorStage, error: unknown) {
  const failures = {
    evidence: { code: "TUTOR_EVIDENCE_FAILED", status: 500, message: "The tutor could not load the selected evidence." },
    provider: { code: "TUTOR_PROVIDER_FAILED", status: 502, message: "The tutor service could not complete the request." },
    completion: { code: "TUTOR_INCOMPLETE_RESPONSE", status: 502, message: "The tutor response was incomplete." },
    decode: { code: "TUTOR_INVALID_JSON", status: 502, message: "The tutor response could not be read." },
    shape: { code: "TUTOR_INVALID_RESPONSE", status: 502, message: "The tutor response did not match the required format." },
    citations: { code: "TUTOR_INVALID_CITATIONS", status: 502, message: "The tutor response did not pass source-reference checks." },
    persist: { code: "TUTOR_SAVE_FAILED", status: 500, message: "The tutor could not save this response." },
  } as const;
  const failure = failures[stage];
  const providerStatus = stage === "provider" && error && typeof error === "object" && "status" in error
    && typeof error.status === "number" && error.status >= 100 && error.status <= 599 ? error.status : undefined;
  return {
    ...failure, stage, providerStatus,
    shapeIssues: stage === "shape" && error instanceof z.ZodError
      ? error.issues.map(issue => ({ path: issue.path.join("."), code: issue.code })) : undefined,
  };
}
