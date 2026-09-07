# Snippets

The book shows V code that it never contains. This spoke explains the
mechanism.

## The two halves

**In `book/*.md`** — Nystrom's directive, unchanged:

```
^code scan-token (1 before, 2 after)
```

**In `vlox/src/*.v`** — markers you add when you translate:

```v
//> scan-token
fn (mut s Scanner) scan_token() {
	...
}
//< scan-token
```

At build time `web/plugins/remark-code-tag.mjs` finds the marked range and
replaces the directive with a highlighted V code block.

V uses `//` for comments, exactly like Java and C. The marker syntax needed
no change at all.

## Directive grammar

| Form | Effect |
| --- | --- |
| `^code name` | Show the marked range |
| `^code name (1 before)` | Add 1 line of leading context |
| `^code name (2 after)` | Add 2 lines of trailing context |
| `^code name (1 before, 2 after)` | Both |
| `^code name (no location)` | Hide the file name above the block |

Names are lowercase, digits, and hyphens only.

## Marker grammar

| Form | Effect |
| --- | --- |
| `//> name` | Start the range `name` |
| `//< name` | End the range `name` |
| `//> Chapter Name name` | Start a range scoped to one chapter |
| `//< Chapter Name name` | End a chapter-scoped range |

Marker lines never appear in the rendered output. The plugin strips them.

## Missing snippets are normal

A `^code` tag with no matching marker renders a striped placeholder that
reads "Not yet translated to V". The build succeeds.

This is deliberate. All 40 chapters build from day one, and the placeholders
are the visible to-do list. Count them to measure progress:

```sh
just book
grep -ro 'div class="snippet-missing"' web/dist | wc -l
```

Match the `div`, not just the class name: every page's inlined CSS also
defines a `.snippet-missing{...}` rule, so a bare `grep -ro 'snippet-missing'`
overcounts by one hit per built page (40).

The book has 1,133 `^code` directives in total (`grep -o '\^code
[-a-z0-9]*' book/*.md | wc -l`). The placeholder count above starts at 1,133
and drops toward 0 as chapters are translated and marked.

## Tag names are not unique across implementations

`scan-token` and `is-at-end` exist twice: once in Scanning (chapter 4,
`vlox`) and once in Scanning on Demand (chapter 16, `vloxvm`). A flat index
lets one implementation's code leak into the other's chapter.

The plugin therefore indexes per source directory and resolves each tag
through the `impl` field of the chapter in `web/src/data/toc.ts`. A new
chapter must declare `impl` or its tags never resolve.

## Trap: the content cache hides plugin changes

Astro's glob loader caches rendered output in
`web/node_modules/.astro/data-store.json`. Adding a marker to a V source
does not invalidate that cache, because the Markdown did not change: the
build reuses a stale placeholder and the plugin never runs.

Clearing only that one path is not reliably enough — Vite's own dependency
cache (`web/node_modules/.vite`), Astro's local cache (`web/.astro`), and a
stale `web/dist` can each independently keep the old output alive. Clear all
four before rebuilding if a snippet you just marked still renders as
missing:

```sh
rm -rf web/.astro web/node_modules/.astro web/node_modules/.vite web/dist && just book
```

## The diff model: line ownership, not spans

Markers nest: `scan-token` wraps `two-char-tokens`, `scanner-class` wraps
`scan-state`, `lox-class` wraps `had-error`. Nystrom's tool assigns every
source line to exactly the *innermost* tag open at that point, via a
push/pop stack (`tool/lib/src/source_file_parser.dart`). A tag's own
rendered snippet is only the lines it owns directly — never the lines a
nested tag carved out of it — so `^code scan-token` shows the switch without
the two-char cases, and a later `^code two-char-tokens` shows just those
cases.

`remark-code-tag.mjs` walks each file once with the same stack. A plain
source line is attributed to whatever tag sits on top of the stack; `//>`
pushes, `//<` pops. Because ownership is a set of line indices rather than a
start/end pair, it can be discontiguous — a tag opened before a nested
range and continued after it renders both pieces with the gap silently
closed, exactly like Nystrom's `added` list. A `//>` with no matching `//<`
simply keeps owning lines through end of file, since nothing ever pops it.

Extracting a contiguous span instead (stripping only marker lines) was the
original bug: every nested marker's lines leaked into the enclosing tag's
snippet, so `^code scanner-class` rendered `scan-state`'s fields too, and
`^code lox-class` rendered `had-error`'s field before its own `^code`
introduced it. Correct-looking, wrong content, no build failure.

## Reused tag names: a plain marker belongs to one chapter

A plain, unscoped `//> name` is not a global fallback every chapter can
reach. Tag names are only unique *within* a chapter — Parsing Expressions'
`match` (the parser helper) and Scanning's `match` (`Scanner.match_char`)
are two unrelated tags that happen to share a name. In Nystrom's model, a
plain marker belongs to whichever chapter the parser's state was in when it
saw that marker; `remark-code-tag.mjs` gets the same answer by reading
`book/*.md` (read-only) rather than replaying parser state: a name's owner
is the *first* chapter in `toc.ts` reading order, within that name's
implementation, whose own Markdown contains `^code name`.

A tag name can also be reused in a *later chapter* via the chapter-scoped
marker form, to show only what that chapter changes rather than a repeat of
the whole thing. `remark-code-tag.mjs` resolves `^code name` in chapter `X`:

1. If `name` has a chapter-scoped version for exactly `X`, use it.
2. Otherwise, among the chapter-scoped versions of `name` that come at or
   before `X`, use the latest one — the state of the file as of `X`.
3. Otherwise, use the plain, unscoped `//> name` tag only if `X` is that
   name's one owning chapter.
4. Otherwise, render the placeholder — `X` hasn't been given this code yet.

Skipping step 4 was a real bug: a flat name -> tag fallback let an
untranslated chapter's `^code` resolve to a same-named tag owned by an
earlier, unrelated chapter (Classes' `lox-class` briefly rendered Scanning's
`Lox` struct), a confident, plausible, wrong answer instead of the honest
placeholder. Chapter-scoping the marker fixes the same-name collision
without collapsing every chapter's `^code` onto one tag.

What this does *not* model: Nystrom's tool also tracks individual added and
removed lines for the "replace N lines" location text, and a
`/* Chapter tag < Chapter tag */` block form for marking deleted lines.
Neither is part of the marker grammar above, and V sources don't need them:
a chapter-scoped `//>`/`//<` pair is enough to show what a chapter changed.

## Adding markers

1. Translate the chapter's code into `vlox/src/` or `vloxvm/src/`.
2. Open the chapter in `book/` and list its `^code` names in order.
3. Wrap the matching V code in `//>` and `//<` markers.
4. Run `just book` and read the chapter. Every block must be correct.
5. Run `just test-chapters` to confirm the snapshot still compiles.

Never rename a tag. The name belongs to Nystrom's prose, which is fixed.
