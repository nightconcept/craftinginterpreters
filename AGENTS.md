# Crafting Interpreters in V

⚠ This file is hard-limited to ≤100 lines. Update spokes, not the hub.

## Intent

This is a fork of Robert Nystrom's *Crafting Interpreters*. It replaces the
Java and C implementations with two implementations in the V language, and it
publishes the book as a static site.

## Prime directive

Do not change Nystrom's prose. Every file in `book/` must stay
byte-identical to the original, word for word.

You can add one thing only: a translator's note. A translator's note explains
a difference between his Java or C text and the V translation. Put each note
in a `<div class="translators-note">` block. Never edit a sentence he wrote.
Read [Translation Rules](docs/repo/translation.md) before you touch `book/`.

## Stack

- **V 0.5.2** — both interpreters. `vlox/` is the tree-walk interpreter.
  `vloxvm/` is the bytecode virtual machine.
- **Astro 7** — the book site, in `web/`. It reads `book/*.md` directly.
- **Node 24 + pnpm 12** — site build and the repository tools in `tools/`.
- **mise + just** — toolchain pins and task runner.

The Dart toolchain in `tool/` is Nystrom's. It is retired. Do not extend it.

## Setup

```sh
mise trust && mise install
just web-install
```

## Essential commands

- **Build the interpreters**: `just build-vlox` and `just build-vloxvm`
- **Build the book**: `just book` (output in `web/dist`)
- **Serve the book**: `just serve` (http://localhost:4321)
- **Test**: `just test` (all suites), `just test-chapters` (per chapter)
- **Format**: `just fmt`
- **Lint**: `just lint`
- **Clean**: `just clean`

## Layout

| Path | Contents |
| --- | --- |
| `book/` | Nystrom's Markdown. Read-only except for translator's notes. |
| `vlox/src/` | The tree-walk interpreter. Part II of the book. |
| `vloxvm/src/` | The bytecode virtual machine. Part III of the book. |
| `web/` | The Astro 7 site and its Markdown plugins. |
| `tools/` | Node scripts: chapter splitting, chapter builds, tests. |
| `test/` | 265 Lox test scripts. Shared by both implementations. |
| `docs/` | The translation plan and the agent spokes. |
| `gen/` | Generated chapter snapshots. Never commit these. |

## How the code gets into the book

The book never contains a literal code block for V code. It contains
`^code <name>` directives. A remark plugin reads the matching `//> <name>`
and `//< <name>` markers out of the V sources and splices the code in at
build time. Add markers when you translate a chapter.

A `^code` tag with no matching marker renders a visible placeholder. The
build still succeeds. This is the normal state for chapters you have not
reached yet. Read [Snippets](docs/repo/snippets.md) for the full rules.

## Spoke index

- [Translation Plan](docs/plan.md) — chapter order, phases, and status
- [Translation Rules](docs/repo/translation.md) — prose rules, translator's notes
- [Snippets](docs/repo/snippets.md) — the `^code` and marker system
- [Architecture](docs/repo/architecture.md) — how the parts fit together
- [Site](docs/repo/site.md) — Astro 7, asides, GitHub Pages
- [Testing](docs/repo/testing.md) — the Lox corpus and chapter builds
