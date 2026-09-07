#!/usr/bin/env node
/**
 * split-chapters
 *
 * Ports the behaviour of tool/bin/split_chapters.dart and
 * tool/lib/src/split_chapter.dart: for every book chapter that has a V
 * implementation, emit a compilable snapshot of that implementation's
 * source tree as it stood at the end of the chapter, under
 * gen/<NN>-<slug>/. tools/build-chapters.mjs then tries to compile each one.
 *
 * SIMPLIFIED MODEL: Nystrom's Dart tool tracks a `start` *and* `end` tag per
 * source line -- code can be added and then later deleted via a `/* ... *\/`
 * block-removal comment form -- plus per-line "location" bookkeeping used
 * only to caption the book's HTML. None of that is reproduced here: our
 * marker vocabulary is only `//> name`, `//< name`, `//> Chapter Name name`,
 * `//< Chapter Name name` (see web/plugins/remark-code-tag.mjs), and V code
 * is assumed to only ACCUMULATE from chapter to chapter -- nothing is ever
 * marked as later deleted. So every source line just needs a single
 * "introduced in chapter" ordinal; a chapter's snapshot is every line whose
 * ordinal is <= that chapter's own ordinal.
 *
 * GUESS CALLED OUT (worth a second pair of eyes): an unscoped `//> name`
 * marker doesn't say which chapter it belongs to -- only a
 * `//> Chapter Name name` marker does. This resolves it by finding the
 * chapter whose book/<slug>.md contains a matching `^code name` directive,
 * the same name -> chapter association web/plugins/remark-code-tag.mjs
 * relies on to splice snippets into prose. Code outside every marked range
 * (a file with no markers at all, e.g. vlox/src/main.v today) is treated as
 * belonging to that implementation's very first chapter, mirroring
 * Nystrom's convention that a whole file's outermost scope is opened by the
 * chapter that introduces the file.
 */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, extname, relative, dirname } from "node:path";
import { chapters, chapterNumber } from "../web/src/data/toc.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const GEN_DIR = join(ROOT, "gen");

const BEGIN = /^\s*\/\/>\s+([-a-z0-9]+)\s*$/;
const END = /^\s*\/\/<\s+([-a-z0-9]+)\s*$/;
const BEGIN_CHAPTER = /^\s*\/\/>\s+([A-Z][A-Za-z\s]+?)\s+([-a-z0-9]+)\s*$/;
const END_CHAPTER = /^\s*\/\/<\s+([A-Z][A-Za-z\s]+?)\s+([-a-z0-9]+)\s*$/;
const CODE_DIRECTIVE = /^\^code ([-a-z0-9]+)/;

const IMPLS = {
  vlox: { dir: "vlox/src", chapters: chapters.filter((c) => c.impl === "vlox") },
  vloxvm: { dir: "vloxvm/src", chapters: chapters.filter((c) => c.impl === "vloxvm") },
};

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

/** impl -> (name -> chapter ordinal), built from every `^code name` directive in book/*.md. */
function buildNameOrdinals() {
  const ordinals = { vlox: new Map(), vloxvm: new Map() };

  for (const [impl, info] of Object.entries(IMPLS)) {
    info.chapters.forEach((chapter, ordinal) => {
      let text;
      try {
        text = readFileSync(join(ROOT, "book", `${chapter.slug}.md`), "utf8");
      } catch {
        return;
      }
      for (const line of text.split("\n")) {
        const m = CODE_DIRECTIVE.exec(line.trim());
        // First chapter to mention a name wins -- that's the chapter that
        // introduces it.
        if (m && !ordinals[impl].has(m[1])) ordinals[impl].set(m[1], ordinal);
      }
    });
  }
  return ordinals;
}

function chapterOrdinalByTitle(impl, title) {
  return IMPLS[impl].chapters.findIndex((c) => c.title === title);
}

/**
 * Parses one V source file into a list of { text, ordinal }, one per source
 * line (marker lines themselves are dropped). `ordinal` is the index, within
 * `impl`'s chapter list, of the chapter that introduces that line.
 */
function parseFile(path, impl, nameOrdinals, warn) {
  const raw = readFileSync(path, "utf8").split("\n");
  if (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();

  // Pass 1: find the lowest ordinal among this file's own top-level
  // (depth-0) markers, to use as the baseline for code outside every range.
  let baseline;
  {
    let depth = 0;
    for (const line of raw) {
      let m = BEGIN_CHAPTER.exec(line);
      if (m) {
        if (depth === 0) {
          const ord = chapterOrdinalByTitle(impl, m[1]);
          if (ord !== -1 && (baseline === undefined || ord < baseline)) baseline = ord;
        }
        depth++;
        continue;
      }
      m = BEGIN.exec(line);
      if (m) {
        if (depth === 0) {
          const ord = nameOrdinals.get(m[1]);
          if (ord !== undefined && (baseline === undefined || ord < baseline)) baseline = ord;
        }
        depth++;
        continue;
      }
      if (END_CHAPTER.test(line) || END.test(line)) depth = Math.max(0, depth - 1);
    }
  }
  if (baseline === undefined) baseline = 0;

  // Pass 2: walk the file for real, assigning each kept line the ordinal of
  // whichever range currently encloses it.
  const stack = [baseline];
  const lines = [];
  raw.forEach((line, i) => {
    let m = BEGIN_CHAPTER.exec(line);
    if (m) {
      const ord = chapterOrdinalByTitle(impl, m[1]);
      if (ord === -1) warn(`${path}:${i + 1}: unknown chapter "${m[1]}" in chapter-scoped marker`);
      stack.push(ord === -1 ? stack[stack.length - 1] : ord);
      return;
    }
    m = BEGIN.exec(line);
    if (m) {
      const ord = nameOrdinals.get(m[1]);
      if (ord === undefined) {
        warn(`${path}:${i + 1}: no ^code directive found for "${m[1]}"; excluding it from every snapshot`);
        stack.push(Infinity);
      } else {
        stack.push(ord);
      }
      return;
    }
    m = END_CHAPTER.exec(line) ?? END.exec(line);
    if (m) {
      if (stack.length > 1) stack.pop();
      else warn(`${path}:${i + 1}: unmatched closing marker (ignored)`);
      return;
    }
    lines.push({ text: line, ordinal: stack[stack.length - 1] });
  });

  if (stack.length > 1) {
    warn(`${path}: ${stack.length - 1} marker range(s) never closed; treating them as open through the end of the file`);
  }

  return lines;
}

function main() {
  const nameOrdinals = buildNameOrdinals();
  const warnings = [];
  const warn = (msg) => warnings.push(msg);

  rmSync(GEN_DIR, { recursive: true, force: true });

  const summary = [];

  for (const [impl, info] of Object.entries(IMPLS)) {
    const srcRoot = join(ROOT, info.dir);
    const parsed = walk(srcRoot).map((file) => ({
      rel: relative(srcRoot, file),
      lines: parseFile(file, impl, nameOrdinals[impl], warn),
    }));

    info.chapters.forEach((chapter, ordinal) => {
      const dirName = `${chapterNumber(chapter.slug).padStart(2, "0")}-${chapter.slug}`;
      const outDir = join(GEN_DIR, dirName);

      let fileCount = 0;
      let lineCount = 0;
      for (const { rel, lines } of parsed) {
        const kept = lines.filter((l) => l.ordinal <= ordinal).map((l) => l.text);
        if (kept.length === 0) continue;
        const outPath = join(outDir, rel);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, kept.join("\n") + "\n");
        fileCount++;
        lineCount += kept.length;
      }

      summary.push({ dir: dirName, impl, files: fileCount, lines: lineCount });
    });
  }

  const dirWidth = Math.max(...summary.map((r) => r.dir.length), "chapter".length) + 2;
  console.log("chapter".padEnd(dirWidth) + "impl".padEnd(9) + "files".padEnd(7) + "lines");
  for (const row of summary) {
    const status = row.files === 0 ? "(no snapshot yet)" : "";
    console.log(
      row.dir.padEnd(dirWidth) + row.impl.padEnd(9) + String(row.files).padEnd(7) + `${row.lines} ${status}`.trim(),
    );
  }

  const withFiles = summary.filter((r) => r.files > 0).length;
  console.log(`\n${withFiles}/${summary.length} chapter(s) produced at least one file under ${relative(ROOT, GEN_DIR)}/.`);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s) while parsing V sources:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  // Always exit 0: an empty or non-compiling snapshot is the expected state
  // while most chapters are still untranslated. build-chapters.mjs is where
  // compile failures get reported.
}

main();
