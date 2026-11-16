type AnalyticsData = Record<string, string | number | boolean>;
type TrackerPayload = {
  website: string | number | boolean;
  name: string;
  url: string;
  title: string;
  referrer: string;
  data: AnalyticsData;
};

declare global {
  interface Window {
    umami?: {
      track(payload: (defaults: AnalyticsData) => TrackerPayload): void | Promise<unknown>;
    };
  }
}

type ReviewOutcome =
  | "review_created"
  | "review_attempt_saved"
  | "review_next_action_saved";

/**
 * Activity and learner self-report only, never evidence of mastery.
 * Accept no notes or record identifiers. Allowlist both data and envelope:
 * the actual review URL contains a source-session ID.
 */
export function trackReviewOutcome(name: ReviewOutcome, action?: "revisit" | "example" | "pause"): void {
  if (typeof window === "undefined") return;
  if (!["review_created", "review_attempt_saved", "review_next_action_saved"].includes(name)) return;
  const data: AnalyticsData = { evidence: "activity_only" };
  if (name === "review_next_action_saved") {
    if (action !== "revisit" && action !== "example" && action !== "pause") return;
    data.action = action;
    data.evidence = "learner_choice";
  }
  try {
    const pending = window.umami?.track((defaults) => ({
      website: defaults.website,
      name,
      url: "/review",
      title: "Review",
      referrer: "",
      data,
    }));
    // Neither synchronous tracker errors nor rejected requests affect saving.
    void Promise.resolve(pending).catch(() => {});
  } catch {
    // Analytics is optional; local persistence is independent.
  }
}
