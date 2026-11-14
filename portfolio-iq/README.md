# PortfolioIQ

A personal investing and learning workspace with **no required login**. Visitors
can start immediately, and each visitor's workspace is saved separately.

## Features

- Holdings: import brokerage screenshots, import CSV files, or add positions
  manually; review extracted details before saving.
- Portfolio overview: allocation, concentration, and gains based on confirmed USD
  price snapshots, not live market quotes.
- Budget: scan receipt photos or enter expenses and income manually, with monthly
  limits and category totals.
- Learning: investing explanations, quizzes, bookmarks, and evidence-led sources.
- Thesis journal: record investment reasoning, risks, and review status.
- Wealth sketch: an adjustable constant-rate illustration, not a forecast.
- Optional seven-question setup: personalize priorities, lesson presentation,
  prompts, brokerage terminology, and the initial wealth time horizon.
- Educational AI assistant: questions are sent only when the visitor chooses Send.
- Optional recovery key and JSON export; neither requires an account.

## Independent workspace

This folder contains the complete PortfolioIQ pnpm workspace. The repository root
contains a separate project, Orvyn. Do not mix their dependencies or API servers.

```sh
git clone https://github.com/tjppppppppp/replit-projects.git
cd replit-projects/portfolio-iq
corepack enable
pnpm install --frozen-lockfile
pnpm run typecheck
```

Use Node.js 24 and pnpm 10.

## Environment and database

Configure these through your hosting platform's secrets manager; never commit
their values:

- `DATABASE_URL`: a PostgreSQL connection for persistent guest workspaces.
- `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`: the
  OpenAI-compatible provider configuration used by the existing server.

Replit-managed AI access and databases do not transfer just by cloning the
repository. Provision your own database and an authorized AI provider connection
in the destination environment.

For a newly provisioned development database, apply the schema:

```sh
pnpm --filter @workspace/db run push
```

Review schema changes before applying them to any database containing real data.

## Run and build

In Replit, the artifact definitions describe the frontend and API services.
Outside Replit, run them as separate processes and configure a reverse proxy:
`/api` routes to the API server, and other routes go to the frontend.

```sh
# Frontend development
PORT=26161 BASE_PATH=/ pnpm --filter @workspace/portfolio-iq run dev

# API development, in another terminal with the required secrets configured
PORT=8080 pnpm --filter @workspace/api-server run dev

# Production builds
PORT=26161 BASE_PATH=/ pnpm --filter @workspace/portfolio-iq run build
pnpm --filter @workspace/api-server run build

# Production API
NODE_ENV=production PORT=8080 node artifacts/api-server/dist/index.mjs
```

Serve `artifacts/portfolio-iq/dist/public` as static files with an SPA fallback to
`index.html`; preserve `/api` routing to the API process.

## Main folders

| Folder | Purpose |
| --- | --- |
| `artifacts/portfolio-iq` | Main React/Vite application |
| `artifacts/api-server` | Guest saving, imports, learning progress, and AI requests |
| `lib/db` | PostgreSQL/Drizzle schema |
| `lib/api-spec` | OpenAPI contract and code generation |
| `lib/api-client-react` | Generated typed frontend API client |
| `lib/api-zod` | Generated request and response validation |
| `scripts` | Developer utilities and guest regression tests |
| `artifacts/mockup-sandbox` | Existing component-preview scaffold |

After changing the API contract:

```sh
pnpm --filter @workspace/api-spec run codegen
```

## Checks

```sh
pnpm run typecheck
pnpm test:personalization
pnpm test:wealth
pnpm test:guest
```

Guest regression tests require their configured PostgreSQL connection and a
Playwright-compatible browser; see `scripts/guest-regression.config.ts` and
`scripts/src/guest-regression/fixture.ts`.

## Privacy and persistence

Actual visitor records live in PostgreSQL, **not in this repository**. A private
HttpOnly browser cookie identifies the visitor's guest workspace. If cookies are
cleared or the visitor changes browsers, the optional recovery key is needed to
regain access.

Uploaded holdings screenshots and receipt photos are processed for extraction;
their source image bytes are not retained in the workspace database. Extracted
records save only after review and confirmation.

This source snapshot excludes credentials, database contents, uploaded reference
files, agent memory, dependencies, and generated build output. GitHub changes do
not automatically publish the running app.
