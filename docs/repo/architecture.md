# Architecture

## What this fork changes

| Upstream | This fork |
| --- | --- |
| `java/` — jlox in Java | `vlox/` — the tree-walk interpreter in V |
| `c/` — clox in C | `vloxvm/` — the bytecode VM in V |
| `tool/` — Dart build, test, split | `tools/` — Node scripts |
| Dart static site generator | `web/` — Astro 7 |
| `site/` — checked-in built HTML | `web/dist/` — generated, not committed |

`book/`, `test/`, and `asset/` carry over unchanged.

## The dependency direction

```
book/*.md ──┐
            ├──> web/ (Astro 7) ──> web/dist ──> GitHub Pages
vlox/src ───┤         ^code splicing
vloxvm/src ─┘
     │
     ├──> tools/split-chapters.mjs ──> gen/<chapter>/ ──> v build
     │
     └──> just build-vlox ──> build/vlox ──> tools/test.mjs <── test/*.lox
```

The V sources are the single source of truth for code. The book reads from
them. Nothing copies code into the book, so the two cannot drift apart.

`book/` is read-only input to the site. The site never writes back into it.

## The two implementations

Both are V, and that is the point of this fork. The difference is the
technique, not the language.

- **`vlox`** — Part II. A scanner, a recursive-descent parser, an AST, and a
  tree-walking evaluator. Corresponds to Nystrom's Java jlox.
- **`vloxvm`** — Part III. A single-pass compiler emitting bytecode, and a
  stack virtual machine. Corresponds to Nystrom's C clox.

They share the `test/` corpus and nothing else. Do not factor common code
out of them. The book builds each one from nothing, and shared modules would
break the chapter snapshots.

## Chapter snapshots

`tools/split-chapters.mjs` reads the snippet markers and writes `gen/NN-slug/`
holding the V sources as they stand at the end of that chapter. Each snapshot
compiles on its own and runs the tests that the chapter has earned.

This is what makes the book verifiable while you work through it. If chapter 9
passes and chapter 10 does not, the mistake is in chapter 10.

`gen/` and `build/` are generated. They stay out of git.

## What was dropped

Nystrom's Dart tool also produced a print layout, an XML export, page tiling,
and benchmark harnesses. None of that is ported. `tool/` stays in the tree as
a reference for semantics until the port is finished, then it goes.

See [Snippets](snippets.md), [Site](site.md), and [Testing](testing.md).
