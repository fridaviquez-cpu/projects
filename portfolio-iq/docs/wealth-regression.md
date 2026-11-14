# Wealth regression checks

Run `pnpm test:wealth` from the project root.

These are repeatable local tests: no running server, database, guest data,
browser installation, or credentials are needed. Vitest renders the real Wealth
page in jsdom, with its real preferences hook, generated API client, React Query
cache, and controls. Only HTTP responses are controlled by the tests.

Coverage:
- Fractional years round to the nearest whole year (halves round up), within
  1–50 years; subsequent slider edits use that normalized duration.
- Number fields, slider values, accessible duration, totals, and every yearly
  chart point agree after rounding or min/max clamping on all four controls.
- Zero return, zero starting amount, zero monthly additions, and combinations
  including an entirely zero balance produce finite, consistent chart paths.
- Exact simultaneous lower/upper limits keep the calculation and chart aligned.
- All horizon mappings: under-3 → 3, 3-5 → 5, 5-10 → 10, over-10 → 25;
  null/unsure do not prefill.
- Every goal changes framing only; other setup answers cannot change assumptions.
- Starting amount stays $1,000, monthly additions $150, and yearly rate 5%
  unless manually edited.
- An independent closed-form monthly-compounding oracle checks the displayed
  balance, contributions, growth, and every yearly chart point.
- Deferred first responses cannot overwrite any manually edited number input;
  keyboard slider edits also prevent prefill.
- Actual React Query invalidation and focus-triggered HTTP refetches preserve
  manual edits, including the previously checked 7-year scenario.
- Horizon prefill runs once; caveats follow saved answers even when the visitor
  manually chooses a different duration.

The suite deliberately excludes guest privacy/recovery, assistant consent, and
lesson/prompt matching, which have separate coverage or tasks. It does not
replace a real-browser accessibility or layout check.
