# Site

The book site is an Astro 7 project in `web/`. It renders the 40 Markdown
files in `book/` and publishes to GitHub Pages.

## Astro 7 notes

Astro 7 ships a new default Markdown processor named Sätteri. Remark plugins
do not run on it. This project needs remark plugins, so it installs
`@astrojs/markdown-remark` and Astro falls back to the unified pipeline.

Do not remove that dependency. Without it the build fails with a message
about `markdown.remarkPlugins`.

## The content collection

`web/src/content.config.ts` uses a glob loader with `base: "../book"`. The
Markdown is read from the repository root, outside the Astro project.

Nothing is copied into `web/`. Nystrom's prose has exactly one home, and the
site is a reader of it.

The book files have no frontmatter. Titles, chapter numbers, part order,
and the previous and next links come from `web/src/data/toc.ts`, which
mirrors the table of contents in Nystrom's `tool/lib/src/book.dart`.

`web/src/pages/contents.astro` builds the `/contents/` page from `toc.ts`
(the `book/contents.md` file is a stub and is filtered out of
`[...slug].astro`). `web/src/components/BookNav.astro` builds the sidebar
table of contents from the same data, plus the active chapter's `##`
headings.

## Plugins

| Plugin | Role |
| --- | --- |
| `remark-code-tag.mjs` | Turns `^code name` into a V code block |
| `remark-aside.mjs` | Tags asides and their anchors for the layout |
| `remark-image-path.mjs` | Rewrites `<img src="image/…">` to sit under the base path |

`remark-code-tag` must run first. It creates the code blocks that later
stages highlight. See [Snippets](snippets.md).

Illustrations are served from `web/public/image` and fonts from
`web/public/font`, both symlinks into `site/`.

## Asides

Nystrom writes a margin note as an anchor plus a block:

```html
The first step is <span name="lexing">scanning</span>.

<aside name="lexing">
...
</aside>
```

`remark-aside.mjs` adds `data-anchor` and `data-aside` attributes. The prose
itself does not change.

Each aside renders inside `article.prose`; on screens wider than 1200px CSS
makes it `position: absolute` and a short script in `Chapter.astro`
measures its anchor and sets its `top` so the two line up, pushing down any
aside that would overlap the one above. Below 1200px asides fall back into
the flow.

The alignment runs again on resize and after web fonts load, because both
change line positions.

## Layout

`Chapter.astro` renders a fixed dark sidebar (`nav.wide`) above 1200px and a
`<details>` disclosure (`.floating`) below it, both containing `BookNav`.
Part-divider pages (slugs that name a part in `toc.ts`) render as
`<h1 class="part">` with a roman numeral.

## Styling

`web/src/styles/book.scss` ports the palette, typography scale, 48px column
unit, sidebar, callout boxes, and blockquote treatment from Nystrom's
`asset/sass/{shared,chapter,contents}.scss` and the `nav` blocks of
`asset/style.scss`. The Crimson serif is self-hosted from `web/public/font`
(the `@font-face` block is in `Chapter.astro` so the URLs carry the base
path); Source Sans 3 and Source Code Pro come from Google Fonts.

Two classes are additions of this fork:

- `.translators-note` — green, clearly not part of the original text
- `.snippet-missing` — the striped placeholder for an untranslated `^code`

## Syntax highlighting

Shiki has no V grammar; `astro.config.mjs` aliases `v` to `go`. Lox has no
grammar either, so `web/grammars/lox.tmLanguage.json` is a minimal one,
loaded through `shikiConfig.langs`. Replace the `v` alias when a real V
TextMate grammar exists. (`ebnf`, used in the grammar chapters, still falls
back to plaintext.)

## GitHub Pages

The repository is the public fork `nightconcept/craftinginterpreters`, so
Pages is available and the site serves under a base path:

```js
site: "https://nightconcept.github.io",
base: "/craftinginterpreters",
```

Always build a link with `import.meta.env.BASE_URL`. A hard-coded absolute
path breaks under the base path.

If you move the site to a custom domain, set `base` back to `/`.

`.github/workflows/pages.yml` builds on a push to `master` and deploys the
artifact. It uses mise, so CI and your machine run identical tool versions.
