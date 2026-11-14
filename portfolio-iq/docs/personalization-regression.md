# Setup personalization regression checks

Run `pnpm test:personalization` from the project root.

The command typechecks the focused tests and runs them with the project's
existing Vitest, jsdom, and React Testing Library setup. No running server,
database, login, browser installation, credentials, or external AI calls are
needed. Install the locked workspace dependencies first with
`pnpm install --frozen-lockfile` if needed.

Coverage:
- All seven original questions: order, titles, single/multiple selection mode,
  exact allowed values and labels, answer round trips, and nullable clearing.
- Real `PreferenceQuestion` interactions: replace, toggle off, and explicitly
  clear single answers; select multiple answers; make brokerage “None”
  exclusive in both directions without losing unrelated answers.
- Dashboard section priorities, objective combinations, stable ties, first
  three actions, destinations, focus text, and beginner action wording.
- Lesson title/track matching for every objective, relevance reasons and their
  precedence, retirement-account matches, the four-minute beginner boundary,
  additive scores, completed-lesson penalty, and input-order tie breaks.
- Learning depth and display flags, including conflicting depth choices;
  simple content folds after two paragraphs without losing the rest.
- Learn page integration with controlled HTTP responses and real generated
  hooks, React Query, cards, lesson dialogs, and assistant panel:
  - Recommendation reasons appear on actual cards; completed lessons remain
    available for review but do not appear in Start here.
  - Opening recommended and track cards applies simple folded content versus
    full detail, quiz-first ordering, visual key points, and interactive prompts.
  - Quiz completion and bookmark/unbookmark responses refresh displayed progress
    without losing reading depth or optional learning preferences.
  - Ask about this lesson and Draft my example close the lesson and fill the
    real assistant input without sending an AI request.
- Thesis reflection triggers, wording, deduplication, ordering, fallback, and
  four-prompt cap.
- All four assistant modes: educational defaults, relevant setup additions,
  first-goal/first-brokerage behavior, horizon labels, and three-prompt cap.
- Brokerage glossary matching, order, “None” exclusion, generic/legacy
  fallbacks, and key educational limitations.
- Settings and step-by-step setup persistence using the actual preferences
  hooks, generated HTTP client, React Query, routing, and confirmation dialogs:
  - Loading placeholders, failed HTTP loads, and successful explicit retries
    without rendering editable empty defaults.
  - Successful background refetches during unsaved edits, retaining the draft
    and current setup step while updating the saved-answer baseline.
  - Failed saves retaining both regular and cleared drafts, unchanged saved
    answers/status, retry, pending-control locking, and navigation only after
    successful setup saves.
  - Successful saves adopting the server response, updating the preferences
    cache and status, clearing dirty state, and invalidating workspace data.
  - Cancelled and confirmed reset/clear dialogs; reset restores the newest
    saved answers, while clear changes only the draft until explicitly saved.
  - Skip confirmation cancellation and failed-save retry; confirmed skip
    retains the newest saved answers rather than committing the partial draft.
  - Distinct new, skipped-empty, and completed-empty status, including fresh
    mounts reading persisted empty answers.
  - Unrelated cached holdings, journal, budget entries, and budget limits
    surviving every scenario; exact preferences-only write payloads and a
    fail-closed HTTP boundary reject unexpected record, login, or AI requests.

Expected original choices and outputs are explicit fixtures, not derived from
the implementation's constants. Synthetic lesson fixtures isolate scoring
from changes to the lesson catalog. The real question component runs inside a
stateful harness so assertions cover the controlled selection after rerender,
not just a callback or a copied toggle algorithm.

These are regression checks for the original rules, not new recommendations.
They leave no-login access and application behavior unchanged. Persistence tests
use isolated clients in StrictMode and controlled HTTP responses; they do not
mock the preferences hooks or React Query. Their financial-record checks cover
client cache isolation and outgoing requests, not database transactions.
Wealth math and
prefill remain in `pnpm test:wealth`; guest privacy and recovery remain in
`pnpm test:guest`. This suite does not replace server-side persistence/privacy
or real-browser accessibility/layout checks.
