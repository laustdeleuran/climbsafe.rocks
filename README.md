# 🧗🏻 Climb Safe

A small static website built with [Astro](https://astro.build) whose content is pulled directly
from the [Climb Safe Notion page](https://app.notion.com/p/laust/Climb-Safe-3e157aa7f94f8076a8fce2abbc43b9a1)
at build time.

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run fetch`   | Fetch content from Notion into `src/data/content.json` |
| `npm run dev`     | Local dev server at `localhost:4321`          |
| `npm run build`   | Build the static site to `./dist/`            |
| `npm run preview` | Preview the production build locally         |

Fetching requires two environment variables:

- `NOTION_TOKEN` — a Notion integration secret. Create an integration at
  <https://www.notion.so/profile/integrations>, then share the Notion page with that integration
  (Page → ⋯ → Connections → add your integration).
- `NOTION_PAGE_ID` — optional; defaults to the Climb Safe page ID.

Without `NOTION_TOKEN`, the build falls back to the committed snapshot in `src/data/content.json`.

## Hosting on GitHub Pages

The workflow at `.github/workflows/deploy.yml` runs on every push to `main` and also manually
via **Actions → "Fetch from Notion and deploy" → Run workflow**. It fetches the latest content
from Notion, commits the refreshed snapshot back to the repo, builds, and deploys to GitHub Pages.

One-time setup:

1. Add the `NOTION_TOKEN` secret (repo **Settings → Secrets and variables → Actions → New
   repository secret**). Without it, deploys build the committed snapshot instead.
2. In repo **Settings → Pages → Build and deployment → Source**, pick **GitHub Actions**.
3. Run the workflow. The site goes live at `https://<user>.github.io/<repo>/`.

The base path is derived automatically from the repo name (`.github.io` repos serve from `/`).

## How content flows

1. `scripts/fetch-notion.mjs` calls the Notion API, walks the page's blocks, downloads any
   Notion-hosted images into `public/notion/`, and writes `src/data/content.json`.
2. `src/pages/index.astro` renders that JSON generically: headings, paragraphs, callouts, lists,
   images, and YouTube videos (embedded via `youtube-nocookie.com`).
3. The workflow commits the refreshed snapshot so every deploy is reproducible and diffs are
   reviewable.
