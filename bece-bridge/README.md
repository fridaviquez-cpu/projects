# BECE Bridge

Source snapshot of the UIUC ECE learning platform and its 30-second animated overview. This is a separate pnpm workspace, not part of the parent Astro portfolio app.

## Contents

- `artifacts/bece-bridge`: student web app, course discovery, Studio, learning, resources and saved work.
- `artifacts/api-server`: API, curriculum metadata, source-grounded tutoring, private-material access controls and engineering computation.
- `artifacts/bece-bridge-film`: editable animation, original kingfisher logo and soundtrack.
- `lib`: database schema, API contracts, generated clients, authentication and AI integration code.
- `scripts`: existing development and verification utilities.
- Workspace configuration and dependency lockfile.

## Development

Run package commands inside this folder, not at the portfolio root. The existing dependency configuration targets Linux.

```sh
cd projects/bece-bridge
pnpm install --frozen-lockfile
```

Each artifact contains development/build scripts and its deployment manifest. Configure database, authentication, object storage and AI service settings separately through secure configuration; never commit credentials. Copying source does not copy student records or grant access to the original database or private uploads.

Recording lifecycle check: `bash artifacts/bece-bridge-film/scripts/validate-recording.sh`. The video source is unchanged, including the previously reported browser-type configuration limitation; this export does not claim a new full typecheck or verified MP4 export.

## Exclusions

No secrets, environment files, student uploads, database contents, session records, agent memory, conversation transcripts, test-result evidence, caches, built output, dependencies, mockup sandbox or rendered MP4. Source tests contain code fixtures, not exported student data. Small assets required by the app and animation are included.

## Portfolio boundary

This adds source only, not a visible portfolio entry or a deployment. Existing portfolio files and beta access restrictions remain unchanged. Review the portfolio build and TypeScript scope before merging the nested workspace: the parent repository automatically deploys its main branch.
