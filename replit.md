# Orvyn

A no-login career workspace adapted from the user's original Orvyn screens.

## Run & Operate

- Start the managed `artifacts/orvyn: web` and `artifacts/api-server: API Server` workflows for preview.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/orvyn test` — guest persistence regression suite (isolated jsdom storage; no live data or AI calls)
- `pnpm --filter @workspace/orvyn typecheck:tests` — typecheck application and regression tests together
- `pnpm --filter @workspace/orvyn test:watch` — rerun regression checks while editing
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- AI configuration is provisioned through Replit AI Integrations. Never expose credentials in the frontend.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- User data: versioned browser-local storage, no server-side career records
- Validation: Zod generated from OpenAPI
- API codegen: Orval (from OpenAPI spec)
- Build: Vite frontend, esbuild ESM API bundle

## Where things live

- `artifacts/orvyn/src/pages/`: original screens adapted for use without login.
- `artifacts/orvyn/src/lib/career-client.ts`: local persistence, validation, CRUD, summaries, AI adapter.
- `artifacts/orvyn/src/lib/resume-drafts.tsx`: recoverable editor drafts.
- `artifacts/orvyn/src/index.css`: original theme.
- `lib/api-spec/openapi.yaml`: AI and text-extraction contracts.
- `artifacts/api-server/src/routes/career.ts`: stateless AI and transient file extraction.

## Architecture decisions

- Do not add account requirements: returning visitors use their browser-local workspace.
- Importing a resume does not retain the source file on the server. Only extracted text is saved locally.
- AI processes explicitly submitted context; it must not invent accomplishments or claim evidence has been verified.
- The original shared DNA scoring package was not supplied. The replacement is a transparently described three-dimension self-reflection, not a validated assessment.

## Product

Dashboard, opportunities pipeline, experience vault, resume editor/import/export/tailoring, interview questions and STAR feedback, Career DNA, insights/goals, and workspace export/restore.

## User preferences

See `.agents/memory/orvyn-requirements.md` for the user's standing product requirements.

## Gotchas

- Browser clearing, private browsing, and device/browser changes affect local persistence. Keep these limits visible in Settings.
- PDF extraction uses package-relative worker assets: keep `pdf-parse` external in the API bundle.
- Resume tailoring supports either a tracked opportunity or a pasted job description.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
