# Guest privacy and recovery regressions

Run from the repository root:

```sh
pnpm test:guest
```

The same command is registered as the `guest-regression` validation check.
It exits nonzero on any failed assertion. Run `pnpm run typecheck` for static checks.

## Prerequisites

- Install the workspace dependencies with `pnpm install --frozen-lockfile`.
- A development PostgreSQL connection must be available through the existing
  `DATABASE_URL` environment setting. Its role needs permission to create and
  drop schemas. Do not supply production credentials.
- Install Chromium once with
  `pnpm --filter @workspace/scripts exec playwright install chromium`.
  On Replit, the suite automatically uses `/repl/tools/bin/chromium` when it
  exists. On other systems where the downloaded browser cannot run, set
  `GUEST_CHROMIUM_EXECUTABLE` to a compatible system Chromium executable.
- The existing AI integration environment settings must be available for
  application initialization. No paid AI requests are made: the browser test
  stubs only the assistant's external answer.

## Isolation and cleanup

The suite creates a randomly named `piq_test_<32 hex characters>` schema with
empty workspace/session tables. It never reads, copies, migrates, or deletes
records from the app's normal tables.

An independent API child process uses that schema as its search path. Before
importing application handlers, it verifies the database connection's actual
`current_schema()` and refuses to start on a mismatch. A test-only Vite origin
routes requests to that API. Managed preview services and production routing
are not reconfigured or restarted by the suite.

Each scenario creates fresh browser contexts and bootstraps guests through the
real API. Session cookies, recovery keys, validation, transactions, and data
calculations all use production code. The persistence scenario terminates and
relaunches the API process, keeping its database schema and browser cookie.

Teardown closes browser contexts, both test servers, and database connections,
then drops only the randomly generated schema. Normal assertion failures still
run teardown. A force-killed test runner or machine can leave an orphaned
`piq_test_...` schema; any manual cleanup must target the exact test schema,
never shared app tables. Generated failure output is ignored under
`generated-artifacts/guest-regression/`. Traces, recordings, and screenshots are
not enabled, so generated recovery keys and cookie values are not retained in
those artifacts.

The fixture defines the two test tables explicitly, matching the current
Drizzle definitions in `lib/db/src/schema/portfolio-workspaces.ts` and
`portfolio-sessions.ts`. Keep those definitions synchronized when schema
changes are intentional.

## Coverage

| Scenario | Regression guarded |
| --- | --- |
| Independent browsers and persistence | Different cookies produce empty, separate workspaces without login; saved preferences, holdings, journal, budget limits, learning bookmarks, and recovery access survive reload and an actual API process restart. Clearing cookies requires recovery or creates a new guest. |
| Session validity | Cookieless and forged sessions cannot read private APIs or write holdings. A server-expired session is rejected even with its cookie still present. Cookies retain HttpOnly, SameSite, persistent expiry, and HTTPS Secure/host-prefix protections. |
| Cross-workspace access | Guessed identifiers and ownership claims cannot read, edit, or delete another guest's holdings, journal, or budget entries; workspace preferences, summaries, and limits remain private. Legitimate owner edits/deletes still work. |
| Recovery | Malformed, unknown, and replaced keys fail without switching the current browser; the replacement works. Public workspace responses do not expose recovery/session hashes or the key. |
| Concurrent tabs | Concurrent creates and unrelated updates preserve holdings, preferences, budget entries/limits, and bookmarks; duplicate deletes cannot remove a different record; rejected writes leave data unchanged. |
| Unknown cost | Unknown stays null through persistence and edits; gains exclude unknown positions. Explicit zero remains a known basis. The UI displays Unknown rather than invented gains. |
| Monthly budget | Ten plus twenty cents remains exactly thirty; one-cent transactions, income, categories, limits, negative balances, month/year boundaries, edits and deletes produce exact totals. Fractional, zero, negative and out-of-range inputs are rejected. |
| Settings restore | A real in-app restore switches cookies, records and personalized experience labels, removes cached overview values even while its replacement request is held, and clears assistant answer history, unsent text and portfolio-sharing consent. Reload retains the restored workspace; unchanged settings do not show an unsaved-changes warning. |

The OpenAPI contract is consumed through generated response validators. No API
contract or no-login product behavior is changed by adding this suite.
