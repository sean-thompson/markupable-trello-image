# Markupable - Trello Image Markup Power-Up

A Trello Power-Up that lets users annotate image attachments with scribbles, dots, and threaded text notes. Built on React 17 + TypeScript + Webpack.

> **Status: Initial implementation complete, not yet tested.** The codebase has been built out from the `optro-cloud/trello-powerup-full-sample` template but has not been run against a live Trello board. Expect bugs and rough edges.

## What it does

- **Card button** "Markup Images" opens a popup listing image attachments on the card
- Clicking an image opens a **full-screen modal** with a drawing/annotation canvas
- Draw **freehand scribbles** or **dots** over images, add **text notes**, and **reply** in threads
- **6-color palette** for annotations (red, orange, yellow, green, blue, purple)
- **Numbered markers** on annotated images with a sidebar list of all annotations
- **Attachment sections** show inline annotated previews on the card back
- **Card badges** display annotation count on the card front
- All data shared across board members via Trello's pluginData (4096-char limit)

## Project structure

```
src/
  capabilities.ts          # Registers power-up capabilities with Trello
  router.tsx               # React Router mapping HTML pages to components
  addon.tsx                # React entry point
  api/power-up.ts          # All data persistence (read/write/add/reply/delete)
  types/power-up.d.ts      # MarkupData, Annotation, Reply interfaces
  types/trello.d.ts        # Trello Power-Up API type definitions
  lib/
    data-model.ts           # Colors, image detection, centroid calculation
    path-encoding.ts        # Path compression (RDP), coordinate normalization
    render-annotations.ts   # Shared canvas rendering + hit testing
    time-utils.ts           # timeAgo() helper
  markup-editor/
    MarkupEditor.tsx        # Core UI: image display, canvas drawing, annotations
    styles.css              # Full-screen editor layout and all component styles
  card-button/
    capability.ts           # "Markup Images" card button registration
    CardButton.tsx          # Image attachment picker popup
    styles.css
  card-badge/capability.ts          # Annotation count badge on card front
  card-detail-badge/capability.ts   # Annotation count on card detail view
  attachment-sections/
    capability.ts           # Claims annotated images for inline preview
    AttachmentSection.tsx   # Annotated image preview with canvas overlay
  show-settings/
    capability.ts           # Settings popup registration
    ShowSettings.tsx        # "Delete All Markup Data" settings page
  on-enable/capability.ts   # Welcome message on install
  on-disable/capability.ts  # Cleanup on disable
  remove-data/capability.ts # Data removal handler
```

## Data model

All annotations for a card are stored in a single JSON blob under the `mkp` key in Trello's `card/shared` scope (4096-char limit). Coordinates use a 0-1000 normalized scale for image-size independence. Paths are simplified with Ramer-Douglas-Peucker to reduce storage. User IDs are mapped to short keys (a, b, c...) to save space.

```json
{
  "u": {"a": "5a12...trello_id", "b": "5b98..."},
  "d": {
    "<attachmentId>": [
      {
        "i": 0,
        "u": "a",
        "p": "500,300;510,305;520,312",
        "c": 4,
        "t": "Fix this alignment",
        "ts": 1708934400,
        "r": [{"u": "b", "t": "Agreed", "ts": 1708935000}]
      }
    ]
  }
}
```

## Getting started (next steps for setup)

This has not been tested yet. To get it running:

### 1. Trello Power-Up registration

1. Go to https://trello.com/power-ups/admin and click **Create New Power-Up**
2. Give it a name (e.g. "Markupable"), select a workspace
3. Note the Power-Up ID from the URL (e.g. `https://trello.com/power-ups/<POWERUP_ID>/edit`)
4. Go to https://trello.com/app-key to get your API key

### 2. Local environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `POWERUP_NAME=Markupable`
- `POWERUP_ID=<your power-up ID from step 1>`
- `POWERUP_APP_KEY=<your API key from step 1>`

### 3. Install and run

```bash
npm install
npm run watch
```

This starts webpack dev server + ngrok tunnel. Copy the ngrok URL it prints.

### 4. Connect to Trello

1. Back on the Power-Up admin page, paste the ngrok URL as the **Iframe Connector URL**
2. On the Capabilities tab, enable: `card-buttons`, `card-badges`, `card-detail-badges`, `attachment-sections`, `show-settings`, `on-enable`, `on-disable`, `remove-data`
3. Open a Trello board, add the Power-Up from the Custom section
4. Attach an image to a card, click "Markup Images" on the card

### 5. Testing checklist

- [ ] Power-up loads without console errors
- [ ] "Markup Images" button appears on cards
- [ ] Image attachments listed in popup
- [ ] Clicking an image opens the full-screen modal
- [ ] Drawing dots and scribbles works (mouse + touch)
- [ ] Text input appears after drawing, post saves the annotation
- [ ] Annotations persist when closing and reopening
- [ ] Numbered markers render on canvas at correct positions
- [ ] Sidebar lists annotations with author, text, timestamps
- [ ] Clicking an annotation opens thread view
- [ ] Replies can be added to threads
- [ ] Color picker works (toolbar for new, thread view for existing)
- [ ] Only the author can change color or delete their annotations
- [ ] Card badges show annotation count
- [ ] Attachment sections show annotated image previews
- [ ] Storage warnings appear near the 4096-char limit
- [ ] Second user sees all annotations and can reply
- [ ] Settings page "Delete All Markup Data" works

## Known gaps / future work

- **Untested** — the full implementation has been written but not run against Trello yet. There will likely be issues with Trello API quirks, CORS, image loading from attachment URLs, etc.
- **Undo** — no undo for the last unsaved drawing (cancel discards, but no stroke-level undo)
- **Static icons** — still using the template's generic icons; should be replaced with a pen/markup icon
- **No offline handling** — if `t.get()`/`t.set()` fails there's basic error alerting but no retry
- **Storage could be tighter** — paths could be delta-encoded or use base36 for further compression if the 4096-char limit becomes a real issue in practice

## Tech stack

- React 17, TypeScript 4, Webpack 5
- Trello Power-Up client library
- HTML5 Canvas for drawing
- No additional runtime dependencies beyond React and React Router

## Building for production

```bash
npm run build
```

Outputs static files to `dist/`. Deploy to any static hosting (S3, Cloudflare Pages, Vercel, etc.) and update the Iframe Connector URL in Trello Power-Up admin to point to the hosted URL.

## License

MIT
