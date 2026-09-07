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
grep -ro 'snippet-missing' web/dist | wc -l
```

The starting count is 1,133, one per `^code` directive in the book.

## Tag names are not unique across implementations

`scan-token` and `is-at-end` exist twice: once in Scanning (chapter 4,
`vlox`) and once in Scanning on Demand (chapter 16, `vloxvm`). A flat index
lets one implementation's code leak into the other's chapter.

The plugin therefore indexes per source directory and resolves each tag
through the `impl` field of the chapter in `web/src/data/toc.ts`. A new
chapter must declare `impl` or its tags never resolve.

## Trap: the content cache hides plugin changes

Astro's glob loader caches rendered output in
`web/node_modules/.astro/data-store.json`. Note the path: it is under
`node_modules`, not `web/.astro`.

Adding a marker to a V source does not invalidate that cache, because the
Markdown did not change. The build then reuses a stale placeholder and the
plugin never runs. If a snippet you just marked still renders as missing:

```sh
rm -rf web/node_modules/.astro && just book
```

## Known gap: Nystrom models chapters as a diff

His Dart tool does more than range extraction. It treats each chapter as a
running diff over the source files, so a `^code` tag can show only the lines
that a chapter *adds* to a file that already exists. The chapter-scoped
marker forms exist to drive that.

The current plugin implements range extraction. It does not implement the
diff model. Most tags do not need it, but some do, and those will render the
wrong range rather than fail loudly.

This is Phase 2 work in [the plan](../plan.md). Until then, check a rendered
snippet against the chapter text when you translate.

## Adding markers

1. Translate the chapter's code into `vlox/src/` or `vloxvm/src/`.
2. Open the chapter in `book/` and list its `^code` names in order.
3. Wrap the matching V code in `//>` and `//<` markers.
4. Run `just book` and read the chapter. Every block must be correct.
5. Run `just test-chapters` to confirm the snapshot still compiles.

Never rename a tag. The name belongs to Nystrom's prose, which is fixed.
