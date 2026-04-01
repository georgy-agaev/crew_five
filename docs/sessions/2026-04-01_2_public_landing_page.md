# Session: Public Landing Page For GitHub Pages

> Date: 2026-04-01
> Status: Completed

## Context

The repository needed a lightweight public landing page that reflects the current product reality
better than the internal README alone:

- `crew_five` as the canonical outbound execution layer
- the current runtime split with `Outreach`
- the direct `crew_five -> imap-mcp` live transport
- the current operator workflow and local runbook

The visual direction should stay close to the existing product UI rather than introducing a new
brand language.

## Completed

- Added a static landing page at the repository root:
  - [index.html](/Users/georgyagaev/crew_five/index.html)
  - [style.css](/Users/georgyagaev/crew_five/style.css)
  - [script.js](/Users/georgyagaev/crew_five/script.js)
  - [assets/icon.svg](/Users/georgyagaev/crew_five/assets/icon.svg)
  - [\.nojekyll](/Users/georgyagaev/crew_five/.nojekyll)
- Reused the current UI palette from `web/src/theme.ts` as the visual base:
  - light workspace background
  - white cards
  - dark text
  - orange action/accent color
- Structured the page around the current live system shape:
  - hero with current project role
  - explicit `crew_five` vs `Outreach` ownership split
  - canonical GTM spine
  - operator workflow
  - minimal live-mode runbook
  - direct links into the key engineering docs
- Added a public landing-page link into [README.md](/Users/georgyagaev/crew_five/README.md).

## Validation

- Opened the page locally with Chrome DevTools MCP:
  `file:///Users/georgyagaev/crew_five/index.html`
- Verified that the main sections render and are navigable:
  - hero
  - system boundary
  - workflow
  - runbook
  - docs
- Fixed one accessibility/rendering issue discovered during validation:
  - hidden mobile menu was still exposed in the accessibility tree
  - added `.mobile-menu[hidden] { display: none; }`
- Captured a full-page screenshot artifact:
  [2026-04-01_landing_page.png](/Users/georgyagaev/crew_five/docs/sessions/assets/2026-04-01_landing_page.png)
- When GitHub Pages was first enabled from `main /` using the legacy branch build, publication
  failed at the Pages layer even though the static files were valid.
- Added a dedicated Pages deployment workflow
  [pages.yml](/Users/georgyagaev/crew_five/.github/workflows/pages.yml) so GitHub deploys only the
  landing-page artifact instead of trying to process the full repository through legacy Pages.

## To Do

- Confirm that the repository Pages source is switched to `GitHub Actions` and that the workflow
  deployment completes successfully.
- If the public site expands beyond a single page, split the static landing from deeper public docs
  instead of pushing more product internals into one page.
