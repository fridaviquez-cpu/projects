# Bridge API regression tests

Run from the repository root:

```sh
pnpm --filter @workspace/api-server test:bridge
```

Requires `DATABASE_URL` pointing to a **development/test PostgreSQL database**
whose role can create schemas. Do not run against production. No AI credentials,
web server, or browser are needed. Missing database configuration fails the suite
rather than skipping coverage.

The runner provides a fresh, test-process-only rate-limit secret and sends the
browser's required `X-Bridge-Request: 1` write header. Real request protection
middleware remains enabled; no application secret is required or changed.

The runner bundles the real Bridge router and generated API validators. Only the
database client and unused AI client are replaced. Each run creates a randomly
named `bridge_test_*` schema from the actual Drizzle schema definitions. All test
connections use that schema exclusively (no public search-path fallback); the
suite drops only its own schema afterward. Existing student tables, pilot
configuration, and records are never queried or changed. A process killed before
teardown can leave its disposable schema behind.

Fixtures include pre-expansion results without a course ID, all four assessed
courses, separate visitor cookies, disabled and unassessed courses, and conflicting
simultaneous submissions. The concurrency test holds initial database reads until
all competing requests have read the unsubmitted row, exercising the real atomic
PostgreSQL update rather than a mocked database or a timing-dependent race.

These tests intentionally use fewer than the route's 60 writes/minute per-IP
limit. Keep tests sequential and preserve that budget when extending the suite.
