# Translation Plan

This fork replaces Nystrom's Java and C implementations with two
implementations in V, and replaces his Dart site generator with Astro 7.

Nystrom's prose does not change. See
[Translation Rules](repo/translation.md).

## Scale

The book is 40 Markdown files holding **1,133 `^code` directives**. Every
one is a piece of Java or C that becomes a piece of V. That count is the
work.

| | Chapters | `^code` tags |
| --- | ---: | ---: |
| Front matter and Welcome | 7 | 0 |
| Part II — tree-walk (`vlox`) | 10 | 317 |
| Part III — bytecode VM (`vloxvm`) | 17 | 793 |
| Backmatter | 2 | 23 |
| **Total** | **36** | **1,133** |

Part III is 70% of the code. Budget accordingly.

## Progress metric

The site builds from day one. Untranslated tags render a visible
placeholder. Count them:

```sh
just book
grep -ro 'div class="snippet-missing"' web/dist | wc -l
```

Match the `div`, not just the class name: every page's inlined CSS also
defines a `.snippet-missing{...}` rule, so a bare `grep -ro 'snippet-missing'`
overcounts by one hit per built page (40, currently).

1,133 means nothing is done. 0 means the translation is complete.

**Current: 1,100.** Chapter 4 accounts for all 33 resolved tags.

Reconcile that total against the per-chapter tag counts in the tables below
every time it moves. A chapter whose placeholder count is lower than its tag
count, and which nobody has translated, is rendering another chapter's code.
That check is what caught the `^code match` and `^code lox-class` leaks; no
per-chapter check found them.

---

## Phase 0 — Scaffolding

**Status: done and verified.**

- `mise.toml` pins V 0.5.2, Node 24, pnpm 12, and just.
- `justfile` holds every task. `just` lists them.
- `vlox/` seeded from `../lox/vlox`: `main.v`, `scanner.v`, `token.v`,
  `enums.v`. This is a partial chapter 4.
- `web/` is an Astro 7 project. It builds all 40 chapters.
- `web/plugins/remark-code-tag.mjs` splices V code into `^code` directives.
- `web/plugins/remark-aside.mjs` and `Chapter.astro` place margin notes.
- `web/src/styles/book.scss` ports Nystrom's palette and type scale.
- `AGENTS.md` and `docs/repo/` describe the rules for agents.

## Phase 1 — Tooling

**Status: done, with one gap.**

Replace the parts of the Dart toolchain that the translation needs.

| Task | Output | Status |
| --- | --- | --- |
| Chapter splitting | `tools/split-chapters.mjs` writes `gen/NN-slug/` | done |
| Chapter builds | `tools/build-chapters.mjs` compiles every snapshot | done |
| Test runner | `tools/test.mjs` runs `test/` against a binary | done |
| Per-chapter test suites | none yet | **missing** |
| Pages CI | `.github/workflows/pages.yml` | done |

`just split` writes 10 snapshots and `just build-chapters` compiles 10 of
10 cleanly.

**The gap: `just test-chapters` runs the whole corpus against every
snapshot.** Chapter 4's snapshot reports 6 passed and 248 failed, because
248 of those tests need a parser that chapter 4 does not have. Nystrom's
Dart tool scopes a suite to each chapter, so a chapter is graded only on
what it is supposed to do by then. Until that lands, `test-chapters` cannot
go green and ground rule 2 cannot be met as written.

Read `tool/lib/src/` for the exact semantics before porting each one. Do not
extend the Dart code.

## Phase 2 — Close the snippet gap

**Status: done and verified.**

`web/plugins/remark-code-tag.mjs` now implements Nystrom's line-ownership
model. A `//>` pushes a frame, a `//<` pops it, and every non-marker line
belongs to the innermost open frame, so a tag owns a possibly-discontiguous
set of lines instead of a flat span. A tag left open at end of file runs to
EOF rather than being dropped.

Three defects it closed, all of them silent:

1. **Nested ranges leaked into the enclosing tag.** In Scanning alone,
   `scanner-class` swallowed `scan-state`, `lox-class` swallowed
   `had-error`, `run-file` swallowed `exit-code`, `prompt` swallowed
   `reset-had-error`, and `scan-token` swallowed `two-char-tokens`.
2. **A plain marker acted as a global fallback.** Tag names are unique only
   within a chapter, so chapter 4's `Scanner.match_char` rendered as Parsing
   Expressions' `^code match`, and chapter 4's `Lox` struct rendered as the
   Classes chapter's `^code lox-class` — confident, plausible, wrong code in
   chapters nobody had translated. A plain marker now belongs to exactly one
   chapter: the first, in reading order and within the same implementation,
   whose Markdown declares the directive.
3. **Context options lost lines to markers.** `(N before, M after)` counted
   physical lines without skipping marker comments, so nine of chapter 4's
   twelve context tags rendered with some or all context missing.

Verified against `java/`, which still holds the marked-up original:
`interpreter-class` owns 20 of `Interpreter.java`'s 537 lines, and
`declaration` in `Parser.java` owns the discontiguous lines 60, 61, 68-75.

Not modelled, and not needed here: Nystrom's added/removed line tracking for
the "replace N lines" location prose, and his `/* Chapter tag < Chapter tag */`
block-comment form for marking deletions.

## Phase 2.5 — Research and plan Part II from chapter 5

**Status: not started. This is the next task.**

Chapter 4 was a mechanical translation with no design content. Chapter 5 is
not. It sets the AST representation for the whole of Part II, and the plan
below assumes a sum type and `match` without having tested that assumption
against the chapters that consume it.

Do this as its own task, before writing chapter 5's code. Its output is a
written design decision in `docs/repo/`, not an interpreter.

Questions it has to answer:

1. **The AST shape.** A V sum type with `match` is the obvious candidate.
   Confirm it against the four passes that consume the AST — the parser
   (6), the interpreter (7), the resolver (11), and `AstPrinter` (5) — not
   against chapter 5 alone. The risk table's mitigation is to prototype
   chapters 5 and 7 together before committing; honour it.
2. **Recursive sum types in V.** `Expr` contains `Expr`. Establish whether
   that needs a reference or a heap allocation, and what that does to
   `match` ergonomics and to the rendered snippets.
3. **`GenerateAst`.** Nystrom generates the AST classes with a Java program.
   V needs no generator for a sum type, which deletes a tool the book spends
   a section on. Decide what `vlox/` contains in its place, and draft the
   translator's note. This is the single largest structural divergence in
   Part II, and Appendix II (23 tags) depends on the same decision.
4. **Control flow as values.** Chapters 6, 7, and 10 use Java exceptions for
   `ParseError`, runtime errors, and `return`. V has `!` results and no
   exceptions. Decide the pattern once, here, rather than three times.
5. **`Environment` and its parent link.** Chapter 8's `Environment` holds a
   reference to its enclosing scope, and chapter 10's closures keep those
   alive. Establish the ownership model before chapter 8, not during it.
6. **Per-chapter test suites.** Phase 1's gap blocks ground rule 2. Decide
   whether that lands before chapter 5 or alongside it.

Deliverable: a spoke in `docs/repo/` recording each decision and its reason,
linked from the spoke index in `CLAUDE.md`. Chapters 5 to 13 then follow it
instead of relitigating it.

## Phase 3 — Part II, the tree-walk interpreter

Translate `java/com/craftinginterpreters/lox/` into `vlox/src/`, chapter by
chapter. Finish a chapter completely before starting the next one: code,
markers, translator's notes, and a green `just test-chapters`.

| # | Chapter | Tags | The hard part in V |
| ---: | --- | ---: | --- |
| 4 | Scanning | 33 | **Done.** 33/33 tags marked, 6/6 `test/scanning` tests pass. The seed's `run()` free-function calls, uninitialized `on_error` field, and inverted argument test are fixed. Java's static `Lox.error()` became a back-reference field on `Scanner`, kept outside every marker so it stays out of the book. Token printing matches Java exactly — upper-case type names, `null` for an absent literal — so the shared corpus applies unchanged. One translator's note, on `Object` becoming `Literal = f64 \| string`. |
| 5 | Representing Code | 18 | **The Visitor pattern.** No Java class hierarchy. Use a sum type and `match`. This decision shapes every later chapter. Blocked on Phase 2.5. |
| 6 | Parsing Expressions | 20 | `ParseError` as control flow becomes a V `!` result. |
| 7 | Evaluating Expressions | 31 | `Object` literals become a sum type. Runtime errors become results. |
| 8 | Statements and State | 40 | `Environment` holds a reference to its parent. Watch V's ownership rules. |
| 9 | Control Flow | 23 | Mostly clean. |
| 10 | Functions | 33 | `LoxCallable` is a Java interface. Return-by-exception needs redesign. |
| 11 | Resolving and Binding | 46 | A second pass over the same sum type. |
| 12 | Classes | 49 | The largest Part II chapter. Java classes modelling Lox classes. |
| 13 | Inheritance | 24 | Depends entirely on chapter 12's shape. |

**Do not skip Nystrom's `GenerateAst` tool.** He generates the AST classes
with a Java program. V's approach is a sum type, which needs no generator.
That difference needs a translator's note in Representing Code, and it is
the single largest structural divergence in Part II.

## Phase 4 — Part III, the bytecode virtual machine

Translate `c/` into `vloxvm/src/`. **Port faithfully.** Where C allocates by
hand, V allocates by hand too. The chapters teach the mechanism, and using
V's built-ins would delete the lesson.

| # | Chapter | Tags | The hard part in V |
| ---: | --- | ---: | --- |
| 14 | Chunks of Bytecode | 55 | `reallocate()` and the growable array, by hand. |
| 15 | A Virtual Machine | 39 | The `ip` is a C pointer. Use an index and note why. |
| 16 | Scanning on Demand | 47 | A second scanner, this time streaming. |
| 17 | Compiling Expressions | 45 | The Pratt parser table holds function pointers. |
| 18 | Types of Values | 36 | The C tagged union becomes a V sum type. Note the size difference. |
| 19 | Strings | 47 | Manual string allocation against V's managed strings. |
| 20 | Hash Tables | 43 | Build the table by hand. V has `map`. Note it, then ignore it. |
| 21 | Global Variables | 54 | Straightforward once the table works. |
| 22 | Local Variables | 33 | Compiler-side scope tracking. |
| 23 | Jumping Back and Forth | 37 | Bytecode patching. Index arithmetic. |
| 24 | Calls and Functions | 81 | **The biggest chapter in the book.** Call frames and the stack window. |
| 25 | Closures | 68 | Upvalues and the open-upvalue list. Heavy pointer work. |
| 26 | Garbage Collection | 64 | Mark-sweep by hand, alongside V's own collector. Needs care and a long note. |
| 27 | Classes and Instances | 34 | Object headers and downcasting. |
| 28 | Methods and Initializers | 57 | Builds directly on 27. |
| 29 | Superclasses | 23 | Method resolution through the chain. |
| 30 | Optimization | 30 | NaN boxing. Bit-level work; V is fine at it. |

Chapters 24, 25, and 26 are 213 tags together, and each depends on the two
before it. Treat them as one block of work, not three.

## Phase 5 — Backmatter

Appendix II holds 23 tags: the generated AST code. In V this is a sum type
declaration, so the appendix shrinks. It needs a translator's note
explaining why.

## Phase 6 — Remove Java and C

**Only after the chapter that references them is translated and tested.**
Until then `java/` and `c/` are the reference for what each `^code` tag must
contain, and they carry the original markers.

Order:

1. Delete `java/` and `jlox/` once Part II passes its tests.
2. Delete `c/` once Part III passes its tests.
3. Delete `tool/`, `Makefile`, and the Dart config. `tools/` replaces them.
4. Delete `site/` and the 12MB of built HTML. Keep `asset/image/`; the book
   references those illustrations.
5. Prune `.gitignore` of the Dart and Xcode entries.

Do not do step 1 early to tidy up. The book is unverifiable without them.

## Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| ~~The snippet diff model is unimplemented~~ | ~~Wrong code renders silently~~ | **Closed.** Phase 2 landed and is verified against `java/` |
| A tag resolves to another chapter's code | Confident, plausible, wrong code in an untranslated chapter | Reconcile the total placeholder count against the per-chapter tag tables on every change |
| `test-chapters` cannot go green | Ground rule 2 is unenforceable | Port Nystrom's per-chapter test suites; see the Phase 1 gap |
| The Visitor decision in chapter 5 | Rewrites chapters 6 to 13 | Phase 2.5 decides it in writing first; prototype chapters 5 and 7 together before committing |
| Shiki has no V grammar | Highlighting is approximate | Aliased to a near grammar; replace when one exists |
| V 0.5.2 is pinned | The language moves fast | Do not bump mid-translation |
| Chapters 24 to 26 | The hardest block, late in the book | Schedule them as one unit |

## Ground rules

1. Never change a word in `book/`. Add translator's notes only.
2. Finish a chapter before starting the next one.
3. Add snippet markers as you translate, not afterwards.
4. Keep `vlox` and `vloxvm` fully separate. Share no code.
5. Keep `java/` and `c/` until their chapters pass.
