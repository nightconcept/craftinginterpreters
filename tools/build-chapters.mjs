#!/usr/bin/env node
/**
 * build-chapters
 *
 * Compiles every chapter snapshot tools/split-chapters.mjs wrote under
 * gen/<NN>-<slug>/ with `v -o build/chapters/<NN>-<slug> gen/<NN>-<slug>`,
 * one at a time. Most snapshots are expected to fail to compile (or to not
 * exist at all) while the V translation is in progress -- that's not a
 * script failure, it's the normal state, so every chapter is attempted and
 * every result is collected before anything is reported. The process still
 * exits 0 even when every single chapter fails: a red exit code here would
 * make this script useless as a "how's the port coming along" status check.
 */
import { readdirSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const GEN_DIR = join(ROOT, "gen");
const BUILD_DIR = join(ROOT, "build", "chapters");

function listGenDirs() {
  let entries;
  try {
    entries = readdirSync(GEN_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((name) => statSync(join(GEN_DIR, name)).isDirectory())
    .sort();
}

function main() {
  const dirs = listGenDirs();

  if (dirs.length === 0) {
    console.log("No chapter snapshots found under gen/. Run `node tools/split-chapters.mjs` first.");
    return;
  }

  mkdirSync(BUILD_DIR, { recursive: true });

  const results = dirs.map((name) => {
    const outPath = join(BUILD_DIR, name);
    const genPath = join(GEN_DIR, name);
    const result = spawnSync("v", ["-o", outPath, genPath], { encoding: "utf8" });

    if (result.error) {
      // `v` itself isn't on PATH -- every chapter fails the same way, but we
      // still finish the loop so the summary is honest about that.
      return { name, ok: false, message: result.error.message };
    }

    const ok = result.status === 0;
    const message = ok ? "" : (result.stderr || result.stdout || `exit ${result.status}`).trim().split("\n")[0];
    return { name, ok, message };
  });

  const nameWidth = Math.max(...results.map((r) => r.name.length), "chapter".length) + 2;
  console.log("chapter".padEnd(nameWidth) + "status".padEnd(9) + "detail");
  for (const r of results) {
    console.log(r.name.padEnd(nameWidth) + (r.ok ? "ok".padEnd(9) : "FAIL".padEnd(9)) + (r.ok ? "" : r.message));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} chapter snapshot(s) compiled cleanly.`);
}

main();
