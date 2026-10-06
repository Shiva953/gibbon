# Gibbon landing page

The product site for [Gibbon](../README.md). Next.js 16 (App Router), Tailwind
CSS 4, TypeScript. Nine static routes, no data fetching, no environment
variables.

```bash
bun install
bun run dev        # http://localhost:3000
bun run build      # prerenders every tab as static HTML
bun run lint
```

## How it is organised

The site is a set of tabs, not one long page. The tab bar reads as the command
line: `$ gibbon` followed by the CLI's own subcommands. Each tab is a route
with one headline, one sentence and a graphic.

| Route | Tab |
|---|---|
| `/` | overview: the hero illustration and the five commands |
| `/plan`, `/apply`, `/status`, `/import`, `/agent` | one per CLI command |
| `/ci`, `/internals`, `/install` | CI setup, how the plan is computed, getting started |

Number keys `1` to `9` jump to a tab and the arrow keys step through them.

## Where things are

| Path | What is in it |
|---|---|
| `src/lib/site.ts` | Repository URL, install command, and the tab list. Change them here |
| `src/app/layout.tsx` | Font (JetBrains Mono), metadata, and the shell around every tab |
| `src/app/globals.css` | Colour tokens, transcript styles, the typing animation |
| `src/components/shell.tsx` | Tab bar, status line, keyboard navigation |
| `src/components/stage.tsx` | The layout every tab uses, and the previous/next pager |
| `src/components/code.tsx` | `Terminal`, `FilePanel` and the `[[tone\|text]]` transcript syntax |
| `src/components/art/` | The illustrations: `primitives.tsx` (isometric layers, columns of light, dither, coins), `hero-art.tsx`, `spot-art.tsx` |
| `src/components/logo.tsx` | The mark, the wordmark, and the four plan glyphs |
| `src/components/plug-demo.tsx` | The kill switch demo on the status tab |

Transcripts are plain template strings so they read like the terminal. Wrap a
run in `[[a|...]]` to colour it: `a` create, `u` update, `r` refund, `w`
blocked, `d` dim, `p` prompt, `c` typed command, `k` key.

## Deploying

Live at [gibbon-cli.vercel.app](https://gibbon-cli.vercel.app), as the Vercel
project `gibbon-site`. To ship a change, from this folder:

```bash
bunx vercel deploy --prod
```

`vercel.json` pins the framework to Next.js. Without it the project falls back
to the "Other" preset and the deploy fails looking for a `public` folder.

To deploy on every push instead, connect the GitHub repository in the Vercel
dashboard and set **Root Directory** to `site`.

`src/app/opengraph-image.png` is the social share image, rendered from the hero
illustration. `docs/preview.png` in the repository root is the screenshot of
this site shown under the title of the main README.
