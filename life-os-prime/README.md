# Life OS Prime

A personal performance dashboard for tracking academics, ventures, leadership, health, and faith — built as a single self-contained web page, not a Replit app.

**Live:** https://tjppppppppp.github.io/life-os-prime/

## What it is

Life OS Prime is an onboarding wizard plus a set of trackers: a daily check-in, a priority triage tool, a focus-session timer, a founder/venture tracker, habits, leadership commitments, a career & wealth log, faith and relationship journals, and weekly/monthly reviews. Every score it shows comes from data you actually log — if there isn't enough yet, it says `INSUFFICIENT DATA` instead of making something up.

## Where your data lives

Everything is stored in your own browser via `localStorage`. Nothing is sent to a server. Clearing your browser's site data for this page removes it; exporting from Settings saves a JSON copy first if you want one.

## AI insight

A few screens ("Strategic Insight", "Which venture deserves attention") can ask Claude for a grounded read on your own logged data. This only works when the page is opened inside a Claude.ai Artifact viewer that grants it — on a plain web host like GitHub Pages, those buttons gracefully say the feature isn't available here, and everything else still works normally.

## Running it yourself

It's one HTML file with no build step and no dependencies beyond two Google Fonts and the page's own inline CSS/JS. Open `index.html` directly, or serve this repo with GitHub Pages / any static host.
