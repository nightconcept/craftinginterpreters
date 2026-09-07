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

The book files have no frontmatter. Titles, chapter numbers, and the
previous and next links come from `web/src/data/toc.ts`, which mirrors the
table of contents in Nystrom's `tool/lib/src/book.dart`.

## Plugins

| Plugin | Role |
| --- | --- |
| `remark-code-tag.mjs` | Turns `^code name` into a V code block |
| `remark-aside.mjs` | Tags asides and their anchors for the layout |

`remark-code-tag` must run first. It creates the code blocks that later
stages highlight. See [Snippets](snippets.md).

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

The aside then sits in the right-hand column of a two-column grid. A short
script in `Chapter.astro` measures the anchor's position and offsets the
aside to match it, then pushes any aside down that would overlap the one
above. Below 1024px the grid collapses and asides fall back into the flow.

The alignment runs again on resize and after web fonts load, because both
change line positions.

## Styling

`web/src/styles/book.scss` ports the palette, the typography scale, and the
48px column unit from Nystrom's `asset/sass/shared.scss`. Fonts come from
Google Fonts: Crimson Pro, Source Sans 3, and Source Code Pro.

Two classes are additions of this fork:

- `.translators-note` — green, clearly not part of the original text
- `.snippet-missing` — the striped placeholder for an untranslated `^code`

## Syntax highlighting

Shiki has no V grammar. `astro.config.mjs` aliases `v` to the closest
available grammar. Replace the alias when a real V TextMate grammar exists.

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
