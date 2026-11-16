# TAU Tactics

A student study companion covering focus, study methods, reusable study plans, reflection, retrieval practice, responsible AI prompts, and a searchable toolkit. Includes Leo, custom focus/break intervals, browser-local study progress, and a separate 30-second animated introduction.

## Layout

- artifacts/tau-tactics — React/Vite study app
- artifacts/api-server — Express API and health endpoint
- artifacts/tau-tactics-film — animated introduction and music
- lib — shared schemas, API clients and supporting packages

This is an isolated source snapshot. It does not replace or integrate with the Astro portfolio at the repository root.

## Local development

Use a recent Node.js version (22 or newer) and pnpm 10.26.1. Run these commands from this directory:

```sh
pnpm install --frozen-lockfile
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/tau-tactics dev
```

For the separate film preview:

```sh
PORT=5174 BASE_PATH=/ pnpm --filter @workspace/tau-tactics-film dev
```

For the API in another terminal:

```sh
PORT=8080 pnpm --filter @workspace/api-server dev
```

Its health endpoint is /api/healthz. The main study features store progress locally and do not require an account or cloud database.

## Checks and builds

```sh
pnpm --filter @workspace/tau-tactics test
pnpm --filter @workspace/api-server test:security
pnpm run typecheck:libs
pnpm --filter @workspace/tau-tactics typecheck
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/tau-tactics build
bash artifacts/tau-tactics-film/scripts/validate-recording.sh
```

The video scaffold has known typecheck limitations; recording-wiring validation is not proof of an exported MP4.

## Limitations

- Saved progress belongs to the current browser/origin, not a synced account.
- AI features generate prompts for external tools, not in-app model responses.
- Actual Safari verification is incomplete.
- Local agent notes, uploaded conversation files, environment credentials, generated build output, and the large rendered MP4 are intentionally excluded. The animation source and its soundtrack are included.
