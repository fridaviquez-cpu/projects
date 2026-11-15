# Replit Projects

Apps I've built and shipped on Replit. Click into any project below for what it
does and a link to the live demo.

| Project | What it is | Live demo |
| --- | --- | --- |
| [Orvyn](projects/orvyn.md) | Career strategy workspace — resume tailoring, interview coaching, Career DNA | [Launch →](https://orvyn-guest-access.replit.app/) |
| [PortfolioIQ](projects/portfolio-iq.md) | CSV-based investment portfolio importer and tracker | [Launch →](https://portfolio-iq-1.replit.app) |
| [Vacancy](projects/vacancy.md) | Desk-finder and focus companion for a campus library | [Launch →](https://vacancy-interactive-desk-experience.replit.app/) |
| [Tau Tactics](projects/tau-tactics.md) | Focus and study companion app | [Launch →](https://focus-tactics.replit.app) |
| [BECE Bridge](projects/bece-bridge.md) | Course-grounded study support for UIUC ECE students | [Launch →](https://bece-bridge.replit.app) |
| [EnviroWaste](projects/envirowaste.md) | Waste and environmental impact tracker | [Launch →](https://envirowaste.foundable.app/) |

---

## Developer notes: Orvyn & PortfolioIQ (source in this repo)

PortfolioIQ is a separate, self-contained project in
[`portfolio-iq/`](portfolio-iq/). It provides a no-login investing workspace with
holdings screenshot imports, receipt scanning, budgeting, learning, a thesis
journal, and optional personalization.

See its [setup instructions](portfolio-iq/README.md). It has its own pnpm workspace
and lockfile; run its commands from `portfolio-iq/`. The existing Orvyn application
below and its root workspace are unchanged.

Orvyn is a career workspace that does not require an account. It includes an
opportunities pipeline, an experience vault, resume editing and tailoring,
interview practice, Career DNA self-reflection, and career insights.

### Edit this project elsewhere

Clone the repository in your preferred editor:

```sh
git clone https://github.com/tjppppppppp/replit-projects.git
cd replit-projects
corepack enable
pnpm install --frozen-lockfile
```

Use Node.js 24 and pnpm 10. This is a pnpm workspace; keep the whole repository
together rather than copying only the frontend folder.

After editing, check the code and push your changes:

```sh
pnpm run typecheck
git add .
git commit -m "Describe your changes"
git push
```

Pull those changes into Replit before continuing work there. Changes pushed to
GitHub do not automatically publish the running website.

### Main folders

| Folder | Purpose |
| --- | --- |
| `artifacts/orvyn/src/pages` | Dashboard and all career tools |
| `artifacts/orvyn/src/components` | Shared interface components and navigation |
| `artifacts/orvyn/src/index.css` | Original Orvyn theme and typography |
| `artifacts/orvyn/src/lib` | Browser persistence, summaries, drafts, and AI adapters |
| `artifacts/api-server/src` | AI requests and temporary resume text extraction |
| `lib/api-spec/openapi.yaml` | API contract |
| `lib/api-client-react` | Generated frontend API client |
| `lib/api-zod` | Generated request and response validation |

After changing the API contract, regenerate the client and validation schemas:

```sh
pnpm --filter @workspace/api-spec run codegen
```

### Running the app

In Replit, start the existing **Orvyn web** and **API Server** workflows. They
provide the ports, routing, and AI configuration.

Outside Replit, run the frontend and API as separate services and configure a
reverse proxy to route `/api` to the API server and other paths to the frontend.
The frontend requires `PORT` and `BASE_PATH`; the API requires `PORT`. The AI
service also needs a valid OpenAI-compatible API configuration through
`AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`. Replit-managed
AI access does not transfer simply by cloning this repository. Keep credentials
in your hosting platform's secret manager, never in source control.

### Where user data lives

Career records and resume drafts stay in the visitor's browser on that device,
not in this repository or the API server. Clearing site data removes them.
Settings provides JSON export and restore for saved records.

Resume imports temporarily send the file to the API for text extraction. AI
features send selected career information for processing; generated results are
then saved in the browser. Review generated content before using it.

Career DNA is an informal, transparently scored self-reflection, not a clinical
or official psychological assessment.
