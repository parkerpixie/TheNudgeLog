# The Nudge Log

A tiny, mobile-first personal interaction tracker for spotting patterns in everyday nudges without turning every moment into a debate.

## What it logs

- **Who** initiated the nudge
- **What kind** of interaction it was:
  - Direct
  - Correct
  - Justify
  - Monitor
  - Handoff
- Whether the input was **asked for**
- Whether the person **kept going** after an answer or preference was already given
- An optional short note

## App structure

### Log
A fast tap-first entry screen designed to be usable from a phone in a few seconds.

### Dashboard
Shows:
- Total nudges
- Unasked-for input
- “Kept going” count
- Breakdown by person
- Breakdown by type
- Recent entries
- CSV export
- Clear-all control

## Privacy

Entries are stored only in the browser using `localStorage`.

There is no account, database, analytics service, or server-side storage in this version.

## Run locally

This is a static app. Open `index.html` directly or serve the folder with any simple static web server.

## Files

- `index.html` — app markup
- `styles.css` — mobile-first UI
- `app.js` — logging, local storage, dashboard, CSV export
- `manifest.webmanifest` — basic installable web-app metadata
