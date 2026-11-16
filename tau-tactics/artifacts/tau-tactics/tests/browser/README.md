# Browser regression tests

Run from the workspace root:

```sh
pnpm --filter @workspace/tau-tactics exec playwright install chromium
pnpm --filter @workspace/tau-tactics test:browser --project=chromium
```

The default command starts and stops its own Vite server on port 4179.
To test an already running preview instead, set `PLAYWRIGHT_BASE_URL` to
its origin. On Replit, use:

```sh
PLAYWRIGHT_BASE_URL="https://$REPLIT_DEV_DOMAIN" \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/repl/tools/bin/chromium \
pnpm --filter @workspace/tau-tactics test:browser --project=chromium
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is optional elsewhere; by default
Playwright uses its installed Chromium. Each test gets isolated browser
storage. The multi-tab tests deliberately share one context and use real
Web Locks. No production data, API server, or AI service is needed.

Tests exercise the actual Plan page, TimerProvider, navigation, clipboard,
and reload. Storage failures are injected at the browser Storage boundary,
not mocked in React. Cancelled and failed replacements compare stored timer,
plans, and reflected history byte-for-byte. Failures retain screenshots and
traces under the ignored root `generated-artifacts/playwright` directory.

## Timer persistence regressions

`timer-persistence.spec.ts` uses Playwright's controlled clock with the real
TimerProvider, Web Locks, localStorage, and Focus History. It covers completion
and reload during a break, suspended/closed-page long absences, explicit start
of the next block, and recovery from both history-write and timer-commit failures.
Assertions compare exact stored records (including IDs and completion times)
with visible History rows and totals. No application code or storage modules
are mocked. Run just this suite with:

```sh
pnpm --filter @workspace/tau-tactics test:browser timer-persistence.spec.ts --project=chromium
```

## Reflection-to-review regressions

Run only the review suite locally:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/repl/tools/bin/chromium \
pnpm --filter @workspace/tau-tactics test:browser reviews.spec.ts --project=chromium
```

On a supported Playwright host, install all three engines and run the matrix:

```sh
pnpm --filter @workspace/tau-tactics exec playwright install chromium firefox webkit
pnpm --filter @workspace/tau-tactics test:browser reviews.spec.ts
```

Install the host libraries using your platform's Playwright setup instructions
when needed. Firefox and WebKit are explicit projects, not silent fallback or
auto-skipped tests. The Chromium executable override applies only to Chromium.
The existing plan and timer tests remain Chromium-only.

The review cases cover:

- Independent tab-local attempt drafts and reload recovery.
- Prompt recovery after navigation/reload without modifying the saved attempt.
- Blocked clipboard writes with both false-returning and throwing legacy-copy
  fallbacks: explicit manual-copy errors, keyboard selection of the complete
  prompt, unchanged review/history bytes, and successful explicit retry into a
  controlled clipboard sink (not an OS clipboard permission test).
- Real storage-event synchronization and stale-revision refusal after reload.
- Deletion observed by a sibling tab without resurrecting the item; its draft
  recovery copy remains in sessionStorage and its source reflection stays intact.
- SessionStorage write quota failure and blocked storage access: an honest warning,
  in-memory navigation recovery, no false promise after reload, and explicit saves.
- Two reflection suggestions submitted together, reopening an existing review,
  a single source-session key, and no resetting of its saved attempt.
- Los Angeles and Tokyo local midnight boundaries (opposite sides of UTC),
  date-input minimums, persisted dates, and ready/later grouping after reload.
- LocalStorage quota failures and blocked access during attempt/prompt saves:
  explicit errors, unchanged stored bytes, recoverable drafts, and successful
  explicit retries after access returns.
- Failed prompt-save recovery after reload, without automatically committing it.
- Blocked deletion retaining the saved attempt and draft until a successful retry.
- Home and detail read-access errors with working retry controls.
- Invalid JSON, invalid record shapes, and mismatched storage identities:
  unreadable originals remain byte-for-byte unchanged, valid siblings can still
  open and save, and mutation-time validation refuses to overwrite corrupt data.
  Restoring the synthetic original allows explicit retry without losing edits.

Fixtures seed only synthetic history/reviews in Playwright's disposable contexts.
Sibling tabs intentionally share localStorage; drafts must remain tab-local.
No timer completion or plan handoff is exercised by this suite. Storage assertions
check saved content, not just success messages. Time tests fix Date while leaving
the event loop running; they check refreshed pages, not automatic midnight refresh.

Verification in the Replit Linux workspace uses Chromium and typecheck.
Earlier Firefox and WebKit launch probes failed
because host shared libraries were unavailable (GTK/X11 for Firefox; GTK4,
GStreamer and related libraries for WebKit). Their tests are configured but not
claimed as passing here. Use the matrix command above on a supported host.
