# Review recovery browser verification

Verified on 2026-11-07 using Playwright 1.65.0 on the workspace Linux host.
The review suite and project configuration were unchanged.

| Project | Engine | Result |
| --- | --- | --- |
| firefox | Firefox 159.0, Playwright build 1572 | 24 passed, 0 skipped |
| webkit | WebKit 27.2, Playwright build 2388 | 24 passed, 0 skipped |

This verifies Playwright WebKit on Linux, not the Safari application on macOS
or iOS. Chromium was outside this run's scope.

## Verified behavior

- Attempt and prompt drafts recover after reload/navigation, remain tab-local,
  and do not silently replace saved work.
- Blocked sessionStorage access and writes give honest recovery warnings.
- Blocked localStorage access, writes, and deletion preserve saved data and
  allow explicit retries.
- Invalid JSON, invalid record shapes, and mismatched identities stay unchanged;
  valid sibling reviews remain usable and stale saves cannot overwrite bad data.
- Cross-tab changes/deletion are observed; stale drafts cannot overwrite newer
  revisions or resurrect deleted records.
- Concurrent reflection submissions queue behind the real `navigator.locks`
  write lock, yielding one review without resetting its attempt.
- Local-midnight date behavior passes in Los Angeles and Tokyo.

## Commands and host setup

### Automated checks

`.github/workflows/review-recovery.yml` runs on pushes, pull requests, and
manual dispatch on GitHub's Ubuntu 24.04 runner. It uses Node.js 22, pnpm
10.26.1, a frozen lockfile, and `playwright install --with-deps chromium firefox
webkit` to install the locked Playwright browser builds and their host libraries.
It runs only this review suite, explicitly selecting all three configured
projects, with focused tests forbidden:

```sh
pnpm --filter @workspace/tau-tactics exec playwright test tests/browser/reviews.spec.ts --project=chromium --project=firefox --project=webkit --forbid-only --reporter=list,html
```

There are no engine skips, host-validation bypasses, retries, or tolerated
test/install failures. Playwright starts its own Vite server on port 4179;
no running Replit preview, API server, or secrets are required.

The `review-recovery-diagnostics` Actions artifact retains the HTML report and
test output for 14 days, including the configuration's failure traces and
screenshots. Upload runs even after a failed test step (unless cancelled).
An engine that fails before creating a browser context may have no trace;
its launch error remains in the job log/report and fails the job.
Download the artifact and open a trace with `pnpm --filter
@workspace/tau-tactics exec playwright show-trace <path-to-trace.zip>`.

The workflow definition is not evidence of a successful hosted run: consult
the Actions result for that commit. Linux WebKit still does not certify Safari
on Apple devices.

### Workspace baseline

Install the pinned browser builds:

```sh
pnpm --filter @workspace/tau-tactics exec playwright install firefox webkit
```

The browser libraries were provisioned through the workspace system-dependency
installer and are recorded in `.replit`. Firefox then passed with:

```sh
pnpm --filter @workspace/tau-tactics exec playwright test tests/browser/reviews.spec.ts --project=firefox --project=webkit
```

That initial matrix invocation reported **24 Firefox passes and 24 WebKit
launch failures**, not skips. Additional WebKit dependencies were provisioned.
The remaining preflight warning was caused by Playwright looking for GLES and
x264 in `ldconfig -p`, which does not list the Nix-installed libraries.
Both libraries were successfully loaded with Python `ctypes.CDLL` before
bypassing this preflight. A subsequent page-creation probe found that headless
WebKit also needed an explicit Mesa EGL vendor manifest.

The final successful WebKit command was:

```sh
__EGL_VENDOR_LIBRARY_FILENAMES=/nix/store/cpwib3zazj49fm0y04y53w4xkbqsgrgm-mesa-25.0.7/share/glvnd/egl_vendor.d/50_mesa.json \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
LD_LIBRARY_PATH=/nix/store/x4sc437gdbhrfbm4b0hja9lfv38njvi1-libglvnd-1.7.0/lib:/nix/store/q6dn7734xv0lh6b9588fw2vp7q7kd9i1-x264-0-unstable-2025-01-03-lib/lib \
pnpm --filter @workspace/tau-tactics exec playwright test tests/browser/reviews.spec.ts --project=webkit
```

Result: **24 passed (39.6s)**, with two workers and no retries or skips.
The host-preflight bypass was printed by Playwright; no engine or test was
disabled. It is not set globally or in the test configuration.

These absolute Nix paths describe this verified host and may change after
reprovisioning. On another host, resolve its installed library directories and
Mesa manifest, verify library loading and page creation first, then run the
tests. Do not blindly suppress host checks or substitute symlinks between
incompatible library versions. The configured projects must continue to fail
explicitly when an engine cannot run.

## Limited-beta decision — 2026-11-07

**Actual macOS Safari has NOT been verified.** No macOS or Safari application
version can be reported because no Apple-host run occurred. iOS Safari is also
unverified. The Linux Firefox/WebKit results above are preserved historical
evidence, not new runs or a claim of Safari compatibility.

The product owner explicitly accepted missing actual Safari coverage as a
documented beta limitation, not a release blocker. There is no authorized remote
Mac runner or Apple-device testing service; do not obtain or create that
infrastructure as part of this beta gate.

### Completed current-environment checks

- `pnpm --filter @workspace/tau-tactics run typecheck`: passed.
- `pnpm --filter @workspace/tau-tactics test`: 27 passed, 0 failed, 0 skipped;
  includes review, storage, timer, and analytics regressions.
- `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/tau-tactics run build`: passed.
  The initial bare build command stopped because the shell lacked the required
  `PORT`; supplying explicit build-time routing values resolved it without code
  changes. Build emitted a tooltip sourcemap diagnostic and a >500 kB bundle
  warning; neither prevented output generation.
- Development preview home page rendered at 1280×720 with no runtime error in
  the capture's browser log. This is a visual smoke check, not interaction testing.

### Unverified checks and known limitations

- Actual macOS/iOS Safari draft recovery, storage failures, malformed-record
  preservation, and concurrent saves remain unverified.
- No fresh full browser matrix, mobile/background-device test, or production
  deployment verification was performed in this gate.
- Saved study data remains browser/device-local, not a backup or cross-device
  sync. Clearing browser data can remove it.
- Existing proposed test gaps are not evidence of reproduced critical failures.
  This gate does not claim comprehensive compatibility or resolve those gaps.

### Post-beta verification backlog

When an authorized Apple host becomes available, use `reviews.spec.ts` as the
scenario checklist in the actual Safari application (not Playwright WebKit).
Record hardware/device, OS and Safari versions, test date, normal/private
storage context, steps, expected/observed outcomes, and automation limitations.
Cover attempt/prompt reload recovery and tab isolation; blocked storage
read/write/delete with explicit retry; byte-preserving malformed records and
usable siblings; stale saves/deletion; and concurrent reflection saves using the
real write lock. Distinguish injected faults from native browser restrictions.
Keep iOS results separate from macOS results.

### Verdict

**READY FOR LIMITED BETA** within the previously approved scope and with the
limitations above. No independently verified critical blocker or specific
Safari-only core-workflow failure was found in the available evidence.
This is a readiness decision, not a production deployment or a Safari
compatibility certification. No features or runtime code were changed.
