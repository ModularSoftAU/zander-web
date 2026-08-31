# SEO / GEO

"GEO" = Generative Engine Optimization: making pages easy for AI answer engines
(Google AI Overviews & AI Mode, Perplexity, ChatGPT Search, Bing Copilot,
Claude) to read, extract facts from, and cite. It layers on top of classic SEO
rather than replacing it — the levers are structured data, answer-shaped text in
the HTML, crawler access, and a machine-readable site map.

## What's in place

### Structured data — `lib/seo/jsonLd.js`

Framework-free builders that produce one `@graph` document per page:

- `buildGraph(config, [nodes])` → a `<script>`-safe JSON-LD string. Always
  prepends the site's `Organization` + `WebSite` nodes (stable `@id`s:
  `${siteUrl}/#organization`, `/#website`) so every URL names the canonical
  entity; page-specific nodes follow.
- Node builders: `webPageNode`, `breadcrumbNode`, `faqNode`, `howToNode`,
  `itemListNode`, `articleNode`, plus `organizationNode` / `websiteNode`.
- `scriptSafe()` hardens output for inline `<script>` (`<`, `>`, `&`, U+2028/9).
- `ROBOTS_INDEX` / `ROBOTS_NOINDEX` — default `<meta name="robots">` values.

`views/modules/header.ejs`:
- Emits `pageJsonLd` (string or array) verbatim when a route supplies one.
- Falls back to an inline base `Organization` + `WebSite` graph when a route
  doesn't, so **every** page carries structured data.
- Adds `<meta name="robots" content="…max-snippet:-1, max-image-preview:large…">`
  (override per page via the `pageRobots` local).

Routes wired so far: `/` (WebPage + FAQ), `/ranks` (WebPage + BreadcrumbList +
`ItemList` of `Product`/`Offer` + FAQ, via `lib/seo/rankSchema.js`), `/play`
(WebPage + BreadcrumbList + `HowTo` + FAQ), `/rules` (WebPage + BreadcrumbList +
`Article` + FAQ).

### Answer-first content

- `/play` — `playHeroHeader.ejs` renders the server addresses and a numbered
  "How to join" list as real HTML (previously the addresses were only inside
  disabled `<input>`s).
- `/rules` — `rules.ejs` shows an "In short" summary + a "Rules FAQ" in the
  HTML. The full ruleset is still `zero-md` (client-rendered external markdown),
  which crawlers/LLMs don't execute — the SSR block + FAQ schema carry the gist.
- `/ranks` — intro paragraph + "Ranks FAQ" section; the rank/perk/price tables
  were already server-rendered.

### Crawler access — `routes/sitemapRoute.js`

- `robots.txt` — explicit `Allow` stanzas for the notable AI user-agents
  (`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`,
  `Claude-SearchBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`,
  `Bingbot`, `Amazonbot`, `Bytespider`, …) plus the generic `*`. Policy is
  **allow all** — tune per-bot by editing `AI_USER_AGENTS` / `DISALLOW`.
- `llms.txt` (new, https://llmstxt.org/) — a curated markdown map of the
  canonical pages, feature-gated, at `/llms.txt`.
- `sitemap.xml` — now emits `<lastmod>`, feature-gates entries, and adds
  `/events`, `/mixed` (+ matches/maps/players), `/shopdirectory`,
  `/punishments`.

## Follow-ups worth doing

- Per-entity sitemap entries: individual events (`/events/:slug`), Mixed maps
  and player profiles, forum categories already covered.
- `Event` JSON-LD on `/events` + event detail; `DiscussionForumPosting` on
  forum threads; `VideoObject` on `/watch`.
- Server-render the Terms / Privacy / Refund markdown (same `zero-md` gap as
  `/rules`). Cleanest fix is a small markdown dependency (`markdown-it`) + a
  cached fetch-and-render helper.
- An `llms-full.txt` with the actual page text inlined.
- Track AI referrals in GA4 (referrer host = `perplexity.ai`, `chatgpt.com`,
  etc.) to measure whether any of this lands.
