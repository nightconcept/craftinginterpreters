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
 * SCOPE NOTE: this implements marker-range extraction. Nystrom's tool also
 * models each chapter as a running diff, so a `^code` can show the lines a
 * chapter *adds* to a file rather than a literal marked range. See
 * docs/repo/snippets.md; that behaviour is Phase 2 work in docs/plan.md.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { visit } from "unist-util-visit";
import { parts } from "../src/data/toc.ts";

// vlox (tree-walk) and vloxvm (bytecode VM) each reuse the same marker
// names, e.g. both scanners define `is-at-end`. A single flat name -> snippet
// map would let one implementation's code leak into the other's chapter, so
// the index is kept per source directory and resolved through the chapter's
// declared `impl` in the table of contents.
const SOURCE_DIRS = ["vlox/src", "vloxvm/src"];
const IMPL_DIR = { vlox: "vlox/src", vloxvm: "vloxvm/src" };
const ROOT = new URL("../../", import.meta.url).pathname;

// slug -> impl, flattened once from the single source of truth in toc.ts.
const SLUG_IMPL = new Map(
  parts.flatMap((part) => part.chapters.map((c) => [c.slug, c.impl])),
);

const CODE_PATTERN = /^\^code ([-a-z0-9]+)( \(([^)]+)\))?$/;
const BEGIN = /^\s*\/\/>\s+([-a-z0-9]+)\s*$/;
const END = /^\s*\/\/<\s+([-a-z0-9]+)\s*$/;
const BEGIN_CHAPTER = /^\s*\/\/>\s+([A-Z][A-Za-z\s]+?)\s+([-a-z0-9]+)\s*$/;
const END_CHAPTER = /^\s*\/\/<\s+([A-Z][A-Za-z\s]+?)\s+([-a-z0-9]+)\s*$/;

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

/** Build a dir -> (name -> {file, lines}) index over every marked range in the V sources. */
function buildIndex() {
  const index = new Map(SOURCE_DIRS.map((dir) => [dir, new Map()]));
  for (const dir of SOURCE_DIRS) {
    const snippets = index.get(dir);
    for (const file of walk(join(ROOT, dir))) {
      const lines = readFileSync(file, "utf8").split("\n");
      const open = new Map(); // name -> start line index

      lines.forEach((line, i) => {
        let m = BEGIN_CHAPTER.exec(line) ?? BEGIN.exec(line);
        if (m) {
          open.set(m[m.length - 1], i + 1);
          return;
        }
        m = END_CHAPTER.exec(line) ?? END.exec(line);
        if (m) {
          const name = m[m.length - 1];
          const start = open.get(name);
          if (start === undefined) return;
          open.delete(name);
          // Strip every marker line from the body before storing it.
          const body = lines
            .slice(start, i)
            .filter((l) => !BEGIN.test(l) && !END.test(l) &&
                           !BEGIN_CHAPTER.test(l) && !END_CHAPTER.test(l));
          snippets.set(name, {
            file: file.slice(ROOT.length),
            start,
            // Raw index of the `//<` line, stored explicitly rather than
            // derived from `body.length`: a nested chapter-scoped marker
            // inside this range would get filtered out of `body`, making
            // `body.length` shorter than the real raw span and truncating
            // the `after`-context slice below.
            end: i,
            body,
            all: lines,
          });
        }
      });
    }
  }
  return index;
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

    visit(tree, "paragraph", (node, i, parent) => {
      const text = node.children?.length === 1 && node.children[0].type === "text"
        ? node.children[0].value
        : null;
      if (text === null) return;

      const match = CODE_PATTERN.exec(text.trim());
      if (match === null) return;

      const name = match[1];
      const { before, after } = parseOptions(match[3]);
      const snippet = snippetsForChapter?.get(name);

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

      // `snippet.start` is the first body line, one past the `//>` marker,
      // so the marker itself sits at `snippet.start - 1`. `before`/`after`
      // count real source lines, not the marker comment, so the slice has
      // to reach one line past the marker on each side; the marker line
      // rides along in the slice and is filtered out below.
      const start = Math.max(0, snippet.start - before - 1);
      const end = Math.min(snippet.all.length, snippet.end + after + 1);
      const value = snippet.all
        .slice(start, end)
        .filter((l) => !BEGIN.test(l) && !END.test(l) &&
                       !BEGIN_CHAPTER.test(l) && !END_CHAPTER.test(l))
        .join("\n")
        .replace(/\s+$/, "");

      parent.children[i] = { type: "code", lang: "v", meta: snippet.file, value };
    });
  };
}
