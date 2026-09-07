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

Replace the parts of the Dart toolchain that the translation needs.

| Task | Output |
| --- | --- |
| Chapter splitting | `tools/split-chapters.mjs` writes `gen/NN-slug/` |
| Chapter builds | `tools/build-chapters.mjs` compiles every snapshot |
| Test runner | `tools/test.mjs` runs `test/` against a binary |
| Pages CI | `.github/workflows/pages.yml` |

Read `tool/lib/src/` for the exact semantics before porting each one. Do not
extend the Dart code.

## Phase 2 — Close the snippet gap

The current plugin extracts a marked range. Nystrom's tool also models each
chapter as a running diff, so a tag can show only the lines a chapter *adds*
to a file. The chapter-scoped markers (`//> Scanning scan-token`) drive that.

Until this lands, some tags render a correct-looking but wrong range. That
is the highest-risk defect in the pipeline, because it fails quietly.

Do this before Part II translation gets far. Verify against `java/`, which
still holds the marked-up original.

## Phase 3 — Part II, the tree-walk interpreter

Translate `java/com/craftinginterpreters/lox/` into `vlox/src/`, chapter by
chapter. Finish a chapter completely before starting the next one: code,
markers, translator's notes, and a green `just test-chapters`.

| # | Chapter | Tags | The hard part in V |
| ---: | --- | ---: | --- |
| 4 | Scanning | 33 | Seeded, but **the seed does not compile**. `../lox/vlox` calls `run()` as a free function at `main.v:35` and `main.v:68` when it is a method, and `Scanner.on_error` is an uninitialized `fn` field. Fix these first. |
| 5 | Representing Code | 18 | **The Visitor pattern.** No Java class hierarchy. Use a sum type and `match`. This decision shapes every later chapter. |
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
| The snippet diff model is unimplemented | Wrong code renders silently | Phase 2, before Part II gets far |
| The Visitor decision in chapter 5 | Rewrites chapters 6 to 13 | Prototype chapter 5 and 7 together before committing |
| Shiki has no V grammar | Highlighting is approximate | Aliased to a near grammar; replace when one exists |
| V 0.5.2 is pinned | The language moves fast | Do not bump mid-translation |
| Chapters 24 to 26 | The hardest block, late in the book | Schedule them as one unit |

## Ground rules

1. Never change a word in `book/`. Add translator's notes only.
2. Finish a chapter before starting the next one.
3. Add snippet markers as you translate, not afterwards.
4. Keep `vlox` and `vloxvm` fully separate. Share no code.
5. Keep `java/` and `c/` until their chapters pass.
