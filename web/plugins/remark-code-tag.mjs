/**
 * remark-code-tag
 *
 * Replaces Nystrom's `^code <name>` directives with a fenced V code block
 * pulled out of the V sources. The prose in `book/*.md` stays byte-identical
 * to the original; only the code that gets spliced in changes.
 *
 * Directive grammar (unchanged from the Dart tool):
 *
 *   ^code lox-class
 *   ^code scan-token (1 before, 2 after)
 *   ^code had-error (no location)
 *
 * Source marker grammar (unchanged, because V uses `//` comments too):
 *
 *   //> scan-token          begin a snippet
 *   //< scan-token          end a snippet
 *   //> Scanning scan-token begin a chapter-scoped snippet
 *   //< Scanning scan-token end a chapter-scoped snippet
 *
 * DIFF MODEL: markers form a push/pop stack, exactly like Nystrom's tool. A
 * non-marker line belongs to whichever tag is innermost open at that point,
 * so a tag's own lines can be discontiguous (an inner, later-chapter marker
 * carves lines out of an outer, earlier one) and a `//>` left unclosed at
 * end of file still owns every line up to EOF. A tag name can also be
 * reused across chapters via the chapter-scoped marker form, each use owning
 * only the lines that chapter directly contributes.
 *
 * A plain, unscoped `//> name` belongs to exactly one chapter too — never a
 * global fallback. Its owner is the first chapter in `toc.ts` reading order
 * (within its implementation) whose own `book/*.md` contains `^code name`.
 * A `^code name` directive resolves against the chapter it appears in: an
 * exact chapter-scoped match wins; otherwise the nearest earlier chapter's
 * scoped version applies (the state of the file as of that chapter);
 * otherwise the plain tag applies only in its one owning chapter. See
 * docs/repo/snippets.md.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { visit } from "unist-util-visit";
import { chapters } from "../src/data/toc.ts";

// vlox (tree-walk) and vloxvm (bytecode VM) each reuse the same marker
// names, e.g. both scanners define `is-at-end`. A single flat name -> snippet
// map would let one implementation's code leak into the other's chapter, so
// the index is kept per source directory and resolved through the chapter's
// declared `impl` in the table of contents.
const SOURCE_DIRS = ["vlox/src", "vloxvm/src"];
const IMPL_DIR = { vlox: "vlox/src", vloxvm: "vloxvm/src" };
const DIR_IMPL = { "vlox/src": "vlox", "vloxvm/src": "vloxvm" };
const ROOT = new URL("../../", import.meta.url).pathname;
const BOOK_DIR = join(ROOT, "book");

// slug -> impl and slug -> title, flattened once from the single source of
// truth in toc.ts. Chapter titles are what the chapter-scoped marker form
// names (`//> Scanning scan-token`), and reading order is what "chapter
// ordering" means when a tag has no exact match for the requesting chapter.
const SLUG_IMPL = new Map(chapters.map((c) => [c.slug, c.impl]));
const SLUG_TITLE = new Map(chapters.map((c) => [c.slug, c.title]));
const CHAPTER_ORDINAL = new Map(chapters.map((c, i) => [c.title, i]));

const CODE_PATTERN = /^\^code ([-a-z0-9]+)( \(([^)]+)\))?$/;
const BEGIN = /^\s*\/\/>\s+([-a-z0-9]+)\s*$/;
const END = /^\s*\/\/<\s+([-a-z0-9]+)\s*$/;
const BEGIN_CHAPTER = /^\s*\/\/>\s+([A-Z][A-Za-z\s]+?)\s+([-a-z0-9]+)\s*$/;
const END_CHAPTER = /^\s*\/\/<\s+([A-Z][A-Za-z\s]+?)\s+([-a-z0-9]+)\s*$/;

/** True for any of the four marker forms, so context slices can filter them out. */
function isMarkerLine(line) {
  return BEGIN.test(line) || END.test(line) || BEGIN_CHAPTER.test(line) || END_CHAPTER.test(line);
}

/**
 * Walk backward from just before `firstLine`, skipping marker lines, until
 * `count` real source lines are collected (or file start is hit). A tag's
 * own `//>` marker sits immediately above `firstLine` by construction, so
 * without this skip a `(1 before)` request would just re-select the marker,
 * which then gets filtered out downstream and silently yields nothing.
 */
function contextBefore(all, firstLine, count) {
  const result = [];
  for (let i = firstLine - 1; i >= 0 && result.length < count; i--) {
    if (!isMarkerLine(all[i])) result.unshift(all[i]);
  }
  return result;
}

/** Same as `contextBefore`, walking forward from just after `lastLine`. */
function contextAfter(all, lastLine, count) {
  const result = [];
  for (let i = lastLine + 1; i < all.length && result.length < count; i++) {
    if (!isMarkerLine(all[i])) result.push(all[i]);
  }
  return result;
}

let index = null;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (extname(path) === ".v") out.push(path);
  }
  return out;
}

/**
 * For each implementation, map a tag name to the single chapter that owns
 * it: the first chapter in `toc.ts` reading order (restricted to that
 * implementation) whose `book/*.md` contains a `^code name` directive.
 *
 * A plain `//> name` marker has no chapter written on it, but in Nystrom's
 * model it still belongs to exactly one chapter — whichever chapter's prose
 * the parser's state was in when it saw that marker. We don't replay parser
 * state; reading distinguishes it from the book's own directives, this
 * gives the same answer, and it is why a `book/*.md` read (not a write) is
 * necessary here.
 */
function buildChapterOwners() {
  const owners = { vlox: new Map(), vloxvm: new Map() };
  for (const c of chapters) {
    if (!c.impl) continue;
    let text;
    try {
      text = readFileSync(join(BOOK_DIR, `${c.slug}.md`), "utf8");
    } catch {
      continue;
    }
    const ownerMap = owners[c.impl];
    for (const line of text.split("\n")) {
      const m = CODE_PATTERN.exec(line.trim());
      if (m && !ownerMap.has(m[1])) ownerMap.set(m[1], c.title);
    }
  }
  return owners;
}

/**
 * Build a dir -> { plain: Map<name, {snippet, owner}>, scoped: Map<name,
 * Map<chapterTitle, snippet>> } index over every tag in the V sources.
 *
 * Each file is walked once with a stack of open tags, mirroring Nystrom's
 * push/pop parser (tool/lib/src/source_file_parser.dart): a non-marker line
 * is owned by whichever tag is innermost open, `//>` pushes, `//<` pops, and
 * a tag left open at end of file simply keeps everything up to EOF. A
 * snippet's `owned` list is therefore the exact (possibly discontiguous)
 * set of line indices that tag contributes directly, not a contiguous span.
 *
 * A plain `//> name` / `//< name` pair belongs to exactly one chapter (see
 * `buildChapterOwners`) — never a global fallback every chapter can reach.
 * A chapter-scoped `//> Chapter name` / `//< Chapter name` pair records a
 * second, later version of the same name, keyed by the chapter that
 * contributed it, so re-marking the same name for a later chapter can never
 * silently overwrite the range an earlier chapter's `^code` still needs.
 */
function buildIndex() {
  const chapterOwners = buildChapterOwners();
  const index = new Map(SOURCE_DIRS.map((dir) => [dir, { plain: new Map(), scoped: new Map() }]));
  for (const dir of SOURCE_DIRS) {
    const { plain, scoped } = index.get(dir);
    const owners = chapterOwners[DIR_IMPL[dir]];
    for (const file of walk(join(ROOT, dir))) {
      const lines = readFileSync(file, "utf8").split("\n");
      const relPath = file.slice(ROOT.length);
      const stack = [];
      const tagsInFile = [];

      lines.forEach((line, i) => {
        let m = BEGIN_CHAPTER.exec(line);
        let chapter = m ? m[1].trim() : null;
        m ??= BEGIN.exec(line);
        if (m) {
          const tag = { chapter, name: m[m.length - 1], owned: [] };
          stack.push(tag);
          tagsInFile.push(tag);
          return;
        }

        m = END_CHAPTER.exec(line);
        m ??= END.exec(line);
        if (m) {
          // Well-formed sources close the innermost tag; trust the nesting
          // rather than matching the closed name, same as the Dart parser
          // (which pops unconditionally and only asserts in commented-out
          // debug code).
          if (stack.length > 0) stack.pop();
          return;
        }

        // A plain source line belongs to whichever tag is innermost open.
        // A tag never closed by end of file still owns every line up to
        // here, since nothing ever pops it off the stack.
        if (stack.length > 0) stack[stack.length - 1].owned.push(i);
      });

      for (const tag of tagsInFile) {
        if (tag.owned.length === 0) continue;
        const snippet = { file: relPath, all: lines, owned: tag.owned };
        if (tag.chapter) {
          if (!scoped.has(tag.name)) scoped.set(tag.name, new Map());
          scoped.get(tag.name).set(tag.chapter, snippet);
        } else {
          plain.set(tag.name, { snippet, owner: owners?.get(tag.name) });
        }
      }
    }
  }
  return index;
}

/**
 * Resolve `name` as it should render for the chapter titled `chapterTitle`.
 *
 * An exact chapter-scoped match wins. Otherwise, among the chapter-scoped
 * versions of `name` that precede `chapterTitle` in reading order, the
 * latest one applies — that's the state of the file as of this chapter.
 * Otherwise, the plain, unscoped tag applies only if `chapterTitle` is the
 * one chapter that owns it (see `buildChapterOwners`) — it is not a global
 * fallback every chapter can reach. A name any other chapter's `^code`
 * references without its own chapter-scoped marker correctly falls through
 * to the placeholder: that chapter hasn't been given that code yet.
 */
function resolveSnippet({ plain, scoped }, name, chapterTitle) {
  const versions = scoped.get(name);
  if (versions) {
    const exact = versions.get(chapterTitle);
    if (exact) return exact;

    const targetOrdinal = CHAPTER_ORDINAL.get(chapterTitle);
    let best;
    let bestOrdinal = -Infinity;
    for (const [title, snippet] of versions) {
      const ordinal = CHAPTER_ORDINAL.get(title);
      if (ordinal === undefined || targetOrdinal === undefined) continue;
      if (ordinal <= targetOrdinal && ordinal > bestOrdinal) {
        best = snippet;
        bestOrdinal = ordinal;
      }
    }
    if (best) return best;
  }
  const p = plain.get(name);
  if (p && p.owner === chapterTitle) return p.snippet;
  return undefined;
}

function parseOptions(raw) {
  const before = /(\d+) before/.exec(raw ?? "");
  const after = /(\d+) after/.exec(raw ?? "");
  return {
    before: before ? Number(before[1]) : 0,
    after: after ? Number(after[1]) : 0,
    showLocation: !/no location/.test(raw ?? ""),
  };
}

export default function remarkCodeTag() {
  return (tree, file) => {
    if (index === null) index = buildIndex();

    // Every `book/*.md` file is named after its chapter slug, so the file
    // on disk tells us which chapter we're in, and the TOC tells us which
    // implementation that chapter's code belongs to.
    const slug = basename(file.history[0] ?? file.path ?? "", ".md");
    const impl = SLUG_IMPL.get(slug);
    const dir = impl ? IMPL_DIR[impl] : undefined;
    const snippetsForChapter = dir ? index.get(dir) : undefined;
    const chapterTitle = SLUG_TITLE.get(slug);

    visit(tree, "paragraph", (node, i, parent) => {
      const text = node.children?.length === 1 && node.children[0].type === "text"
        ? node.children[0].value
        : null;
      if (text === null) return;

      const match = CODE_PATTERN.exec(text.trim());
      if (match === null) return;

      const name = match[1];
      const { before, after } = parseOptions(match[3]);
      const snippet = snippetsForChapter && chapterTitle
        ? resolveSnippet(snippetsForChapter, name, chapterTitle)
        : undefined;

      if (snippet === undefined) {
        // Untranslated chapters are the normal state early on. Show a visible
        // placeholder instead of failing the build, so the site always builds.
        parent.children[i] = {
          type: "html",
          value: `<div class="snippet-missing">Not yet translated to V: ` +
                 `<code>^code ${name}</code></div>`,
        };
        return;
      }

      // `owned` holds exactly the source line indices this tag contributes,
      // in file order; it may skip over lines a nested, later-chapter tag
      // claimed. `before`/`after` context is real source lines immediately
      // around the tag's own first and last owned line, not around a
      // contiguous span.
      const firstLine = snippet.owned[0];
      const lastLine = snippet.owned[snippet.owned.length - 1];
      const beforeLines = contextBefore(snippet.all, firstLine, before);
      const ownedLines = snippet.owned.map((lineIndex) => snippet.all[lineIndex]);
      const afterLines = contextAfter(snippet.all, lastLine, after);

      const value = [...beforeLines, ...ownedLines, ...afterLines]
        .filter((l) => !isMarkerLine(l))
        .join("\n")
        .replace(/\s+$/, "");

      parent.children[i] = { type: "code", lang: "v", meta: snippet.file, value };
    });
  };
}
