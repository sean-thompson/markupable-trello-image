# Markupable — Claude Code Project Notes

## Project Overview

Markupable is a Trello Power-Up that lets users annotate image attachments with freehand
drawings, dots, and threaded text notes. See README.md for full details.

## Key Constraints

- **4096-character hard limit** on pluginData per card. Every byte matters in the data model.
- **React 17** (not 18). No concurrent features, no `useId()`, no automatic batching outside events.
- **Trello client library** loaded via script tag, accessed through `window.TrelloPowerUp`.
- **Server-side image proxy**: Trello attachment images are fetched through a `/trello-image` proxy endpoint to avoid CORS blocks.
- **No test framework** currently configured. Any test additions would need Jest/Vitest setup.

## Development Workflow

1. Run `npm run watch` (or use `/renew-cloudflared` skill) to start dev server + tunnel.
2. Update tunnel URL in Trello Power-Up admin (both Iframe Connector URL and Allowed Origins).
3. Refresh Trello board to pick up changes.

## File Layout

```
src/
  capabilities.ts          — Power-Up capability registration (entry point)
  addon.tsx                — React entry point
  router.tsx               — React Router setup with lazy-loaded components
  api/power-up.ts          — All data persistence logic (read/write/add/reply/delete)
  markup-editor/
    MarkupEditor.tsx       — Core annotation UI (largest component)
    styles.css             — Full-screen layout styling
  card-button/
    CardButton.tsx         — Image attachment picker popup
    capability.ts          — Card button registration
  attachment-sections/
    AttachmentSection.tsx   — Inline preview with canvas overlay
    capability.ts          — Attachment section registration
  card-badge/capability.ts — Annotation count badge
  card-detail-badge/       — Detail view badge
  show-settings/           — Settings page (delete all data)
  on-enable/               — Welcome message on install
  on-disable/              — Cleanup on disable
  remove-data/             — Data removal handler
  types/
    power-up.d.ts          — Data model interfaces (Annotation, Reply, MarkupData)
    trello.d.ts            — Trello Power-Up API type definitions
  lib/
    data-model.ts          — Colors, image detection, centroid calculations
    path-encoding.ts       — RDP path compression, coordinate normalization
    render-annotations.ts  — Shared canvas rendering and hit testing
    time-utils.ts          — timeAgo() helper
    trello-auth.ts         — Trello REST API auth helpers and image proxy
templates/                 — Handlebars templates for HTML pages
static/                    — Icons and favicon
webpack.config.ts          — Build config with HtmlWebpackPlugin per page
```
