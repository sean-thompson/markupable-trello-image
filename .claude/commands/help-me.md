---
description: Interactive onboarding helper — ask me anything about this project
allowed-tools: Read, Glob, Grep, WebSearch
---

# Markupable — Project Helper

You are an interactive onboarding assistant for the Markupable project. Answer the user's question conversationally using the knowledge below. Don't dump everything at once — respond to what they actually asked, and offer to go deeper if relevant.

If the user's question goes beyond what's covered here, read CLAUDE.md, README.md, and the relevant source files to find the answer.

## What this project is

Markupable is a Trello Power-Up that lets users annotate image attachments on Trello cards with freehand drawings, dots, and threaded text notes. Annotations are stored in Trello's pluginData (4096-character hard limit per card).

## Architecture

Two deployment targets:

- **GitHub Pages** hosts the frontend (HTML/JS/CSS). Auto-deploys on push to `main` via a GitHub Actions workflow (`.github/workflows/deploy.yml`). The production URL is configured in the Trello Power-Up admin as the Iframe Connector URL.
- **Cloudflare Workers** hosts the image proxy (`worker/` directory). Deployed manually via `cd worker && npx wrangler deploy`. The proxy fetches Trello attachment images server-side to avoid CORS blocks. Its URL is stored in the GitHub Actions variable `TRELLO_IMAGE_PROXY_URL` and injected at build time.

## Key slash commands

- `/deploy` — Deploy the frontend and/or Worker. Handles committing, pushing, wrangler deploy, and release tagging.
- `/renew-cloudflared` — Start the local dev server with a cloudflared tunnel. Returns a temporary public URL.
- `/help-me` — This command. Ask anything about the project.

## Switching from production to local dev

1. Run `/renew-cloudflared` to start the dev server + cloudflared tunnel.
2. Go to https://trello.com/power-ups/admin and update:
   - **Iframe Connector URL** — paste the tunnel URL
   - **Allowed Origins** — paste the tunnel URL
3. Refresh the Trello board to pick up changes.

## Switching back to production

1. Restore the GitHub Pages URL in the Trello Power-Up admin (both Iframe Connector URL and Allowed Origins).
2. Kill the local dev server (Ctrl+C or close the terminal).

## Security precautions

- **`POWERUP_APP_KEY`** is stored in `.env` (gitignored) for local dev and as a GitHub Actions secret for production builds. **Never commit it.**
- The same key is also a **Cloudflare Worker secret** (`wrangler secret put POWERUP_APP_KEY`). If you rotate the key, update it in all three places: `.env`, GitHub secret, and Cloudflare Worker secret.
- **`TRELLO_IMAGE_PROXY_URL`** is a public URL. It's stored as a GitHub Actions **variable** (not a secret) because it's not sensitive.
- The Worker proxy **validates hostnames** (only allows `trello-attachments.s3.amazonaws.com` and similar) to prevent open-proxy abuse.
- The Worker returns `Access-Control-Allow-Origin: *` but requires a valid Trello token query parameter, which limits abuse to authenticated Trello users.

## Key constraints

- **React 17** (not 18) — no concurrent features, no `useId()`, no automatic batching outside event handlers.
- **4096-character pluginData limit** — the data model uses aggressive compression (RDP path simplification, coordinate normalization) to fit annotations.
- **No test framework** currently configured.

## File layout

The frontend source is in `src/`. Key areas:
- `src/capabilities.ts` — Power-Up entry point
- `src/markup-editor/MarkupEditor.tsx` — Core annotation UI
- `src/api/power-up.ts` — All data persistence logic
- `src/lib/` — Shared utilities (rendering, path encoding, auth)
- `worker/src/index.ts` — Cloudflare Worker image proxy

---

Now answer the user's question using this knowledge. Be helpful and conversational. If they haven't asked a specific question, give a brief overview and ask what they'd like to know more about.

User's input: $ARGUMENTS
