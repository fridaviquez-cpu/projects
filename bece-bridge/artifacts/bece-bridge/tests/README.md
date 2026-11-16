# Saved tutor Markdown rendering

The `?supported-images` fixture covers full, collapsed, and shortcut Markdown
image references with HTTPS, document-relative, parent-relative, and root-relative
destinations. On initial render and reload, the `@destinations` test checks exact
alt text, raw and resolved src, complete loading, and intrinsic image dimensions.
Every expected image request must be fulfilled locally again after reload;
unknown images and external requests are blocked (font CSS is stubbed locally).
This checks saved-content rendering, not backend image storage.

The `?inline` fixture checks literal backslash math delimiters in single-,
double-, and triple-backtick code spans, including embedded shorter backtick
runs. It asserts exact code text before and after reload, no math inside code,
and successful rendering of each adjacent prose equation.

Run `pnpm --filter @workspace/bece-bridge test:tutor-rendering`.

The suite starts and stops an isolated Vite fixture server. Chromium runs the
full suite; Firefox and WebKit run the `@destinations` checks with the same
fixtures, interception, and assertions (no engine-specific safety exceptions).
On Replit it uses `/repl/tools/bin/chromium`; elsewhere install Chromium with
`pnpm --filter @workspace/bece-bridge exec playwright install chromium`, or set
`CHROMIUM_PATH` to an installed executable. That override and `--no-sandbox`
apply only to Chromium, never to Firefox or WebKit.

On a Playwright-supported host, install the additional engines with
`pnpm --filter @workspace/bece-bridge exec playwright install --with-deps firefox webkit`.
Run only the three-engine destination matrix with
`pnpm --filter @workspace/bece-bridge test:tutor-rendering --grep @destinations`.
Missing browsers or host libraries fail explicitly rather than silently skipping
coverage. On an unsupported host (such as a Nix environment without compatible
Playwright browsers), run the available engine explicitly:
`pnpm --filter @workspace/bece-bridge test:tutor-rendering --project=chromium`.
This is partial coverage, not evidence of a Firefox/WebKit pass.

Verification on the Replit Nix host: the full command discovered eight tests;
all six Chromium tests passed. Firefox and WebKit each failed at browser launch
because required host libraries were missing, even after downloading their
Playwright binaries. Neither engine's assertions ran on this host.

Fixtures are frozen saved-answer Markdown, rendered by the same `Markdown`
component used for `turn.answer` in `src/components/tutor-conversation.tsx`,
with the real app stylesheet and conversation card spacing. They intentionally
do not regenerate summaries using backend code. The suite checks mixed,
limited-pass, and unchecked reports after a page reload at 320, 390, and 1280px.
It measures paragraph wrapping, page overflow, and access to the end of long
code blocks, as well as exact original arithmetic/conversion claims and warnings.

This is a client-rendering regression, not an API persistence, authentication,
or Library navigation test. Backend persistence has separate coverage. Passing
these tests does not validate the mathematical or physical claims in fixtures.

The `?security` fixture uses only synthetic hostile saved Markdown. It checks
initial rendering and reloads for escaped script/event-handler HTML, inert
JavaScript links (including mixed-case, entity-encoded, and reference forms),
absence of executable DOM attributes, script side effects, dialogs, and image
requests. A normal HTTPS source link is clicked against a locally intercepted
destination, so the test does not contact a source website or alter permissions.

The `?destinations` fixture adds inline and reference links and Markdown images
for JavaScript, data HTML/SVG, VBScript, and synthetic file URLs (plus mixed-case
and entity-encoded variants). On initial render and reload, unsafe href/src
attributes must be absent or empty, images must not load, and clicking links
must not leave the fixture or open another page. Dialogs and navigations are
monitored. All non-fixture requests are intercepted before rendering; only the
synthetic HTTPS source and image are fulfilled locally, with other destinations
aborted and reported as failures. The HTTPS image must load and the source link
must navigate successfully. The stylesheet's Google Fonts request receives
empty CSS locally rather than contacting Google. This verifies renderer sanitization even where
an engine itself would not execute an obsolete scheme such as VBScript.
Service workers are blocked so they cannot bypass destination interception.

The `?math-security` fixture exercises synthetic untrusted KaTeX HTML class,
ID, style and data commands, JavaScript/data URL commands, image loading and
attribute-breakout attempts in both inline and display math, initially and after
reload. Tests inspect the rendered DOM for injected attributes, links and active
elements, record dialogs and block/record synthetic destination requests. Exact
TeX annotations confirm the math pipeline ran; ordinary fractions, powers and
square roots alongside each attack must still render. This tests the shared
renderer’s default untrusted KaTeX behavior without changing source permissions.

The `?supported-destinations` fixture provides positive coverage for HTTPS
reference links, inline/reference fragments, and document-, parent-, and
root-relative links (including queries and fragments). Each link's label and
raw href are checked on initial rendering and after reopening via reload.
Each link is clicked in both states: HTTPS/relative destinations must resolve
to the expected URL and locally fulfilled document, while fragments must select
the existing target without leaving the answer or requesting a document.
All navigation destinations and external stylesheet requests are intercepted
before rendering; unexpected destinations are aborted and fail the test.
