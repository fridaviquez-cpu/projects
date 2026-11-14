# PortfolioIQ

A private, no-login personal investing workspace for manual portfolio snapshots, investing education, a thesis journal, and monthly budgeting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server through its managed workflow
- `pnpm --filter @workspace/portfolio-iq run dev` — frontend (use its managed workflow for the assigned port and base path)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm test:wealth` — isolated wealth personalization and calculation regression checks (see `docs/wealth-regression.md`)
- `pnpm test:personalization` — isolated setup, lesson, and prompt matching regression checks (see `docs/personalization-regression.md`)
- `pnpm test:guest` — repeatable guest privacy/recovery checks in isolated disposable workspaces (see `docs/guest-regression.md`)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- AI: Replit-managed `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`; never print these values

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/portfolio-iq/` — React frontend, routed at `/`
- `artifacts/api-server/src/routes/portfolio/` — private guest APIs, routed under `/api`
- `artifacts/api-server/src/lib/portfolio-store.ts` — guest sessions and transactional document edits
- `artifacts/api-server/src/lib/portfolio-summary.ts` — snapshot and monthly budget calculations
- `artifacts/api-server/src/lib/learning-catalog.ts` — original educational explanations and quizzes
- `lib/db/src/schema/portfolio-*.ts` — PostgreSQL workspace and session tables
- `lib/api-spec/openapi.yaml` — source of truth for typed API contracts

## Architecture decisions

- Rebuilt from the public PortfolioIQ site because the creator cannot access the original workspace. No old private user data has been migrated.
- Required login is deliberately absent. First bootstrap creates a new empty private workspace; sample holdings require an explicit user action.
- Server-saved guest data is accessed through a persistent HttpOnly cookie. Optional high-entropy recovery keys support cross-device use without requiring accounts.
- Recovery keys grant access to the entire workspace. Only hashes are stored; generated keys are displayed once and must never appear in URLs or logs.
- Row-locked workspace edits prevent separate tabs from overwriting unrelated changes.

## Product

- Overview with calculated allocation, unrealized gains, and educational observations
- Add, edit, and delete manual holdings with optional total cost basis
- Thesis journal with researching/invested/reviewing/archived statuses
- Monthly income and expense ledger with spending limits
- Learning topics, quizzes, and bookmarks saved to the guest workspace
- Client-side wealth-growth illustration, not a forecast
- Optional educational AI companion; portfolio context is sent only with explicit consent, never budget or journal data
- Settings with preferences, data export, and workspace recovery

## User preferences

- Visitors must be able to start using the app without logging in, while retaining their own separately saved data.
- The requested reference is `https://portfolio-iq.replit.app`, not Orvyn.
- The user wants a good user experience guided by NN/G's ten usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/

## Gotchas

- Bootstrap `/api/workspace` before mounting child API queries; simultaneous cookieless requests must not each create a guest.
- Prices are manual USD snapshots, not live quotes. Never invent historical returns or fund overlap.
- Monetary amounts are integer cents. Cost basis is total paid for a position, not per-share cost; unknown cost basis stays `null`.
- Cookie deletion removes access unless the visitor retained a recovery key. Guest cookies last one year and renew on return.
- Restore switches workspaces; clear client caches so another workspace's records cannot remain visible.
- Re-run OpenAPI codegen after contract edits. The client requires DOM iterable types and React Query v5 generation.
- Schema changes are pushed to development with Drizzle; production schema changes go through Publish, never startup migrations.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
