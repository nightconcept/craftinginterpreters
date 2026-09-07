#!/usr/bin/env node
/**
 * test
 *
 * Ports the expectation-parsing and comparison logic of tool/bin/test.dart
 * against the 265 `.lox` files under test/. Nystrom's original also carries
 * a per-chapter map of which test subdirectories to skip (his tool tests
 * both jlox/clox *and* every early book checkpoint); that mapping is
 * specific to his C/Java chapter split and doesn't have a faithful
 * equivalent yet for the V ports, so this runs the *entire* suite against
 * whichever binary it's asked to check rather than guessing which subset
 * applies. Early chapter snapshots are expected to fail most of it.
 *
 * Usage: node tools/test.mjs <vlox|vloxvm|chapters>
 */
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { spawnSync } from "node:child_process";
import { chapters } from "../web/src/data/toc.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const TEST_DIR = join(ROOT, "test");

const NON_TEST = /\/\/\s*nontest/;
const EXPECTED_OUTPUT = /\/\/\s*expect:\s?(.*)/;
const EXPECTED_ERROR = /\/\/\s*(Error.*)/;
const ERROR_LINE = /\/\/\s*\[(?:(java|c) )?line (\d+)\]\s*(Error.*)/;
const EXPECTED_RUNTIME_ERROR = /\/\/\s*expect runtime error:\s*(.+)/;
const SYNTAX_ERROR = /\[.*line (\d+)\]\s*(Error.+)/;
const STACK_TRACE_LINE = /\[line (\d+)\]/;

function walkLoxFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walkLoxFiles(path, out);
    else if (entry.endsWith(".lox")) out.push(path);
  }
  return out;
}

/** Parses one .lox file's expectation comments. Returns null if it's not a real test. */
function parseExpectations(path, language) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  const expectedOutput = []; // { line, text }
  const expectedErrors = new Set(); // "[line] message"
  let expectedRuntimeError = null;
  let runtimeErrorLine = 0;
  let expectedExitCode = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    if (NON_TEST.test(line)) return null;

    let m = EXPECTED_OUTPUT.exec(line);
    if (m) {
      expectedOutput.push({ line: lineNum, text: m[1] });
      continue;
    }

    m = ERROR_LINE.exec(line);
    if (m) {
      const lang = m[1];
      if (lang === undefined || lang === language) {
        expectedErrors.add(`[${m[2]}] ${m[3]}`);
        expectedExitCode = 65;
      }
      continue;
    }

    m = EXPECTED_ERROR.exec(line);
    if (m) {
      expectedErrors.add(`[${lineNum}] ${m[1]}`);
      expectedExitCode = 65;
      continue;
    }

    m = EXPECTED_RUNTIME_ERROR.exec(line);
    if (m) {
      runtimeErrorLine = lineNum;
      expectedRuntimeError = m[1];
      expectedExitCode = 70;
    }
  }

  if (expectedErrors.size > 0 && expectedRuntimeError !== null) {
    return { error: "cannot expect both a compile error and a runtime error" };
  }

  return { expectedOutput, expectedErrors, expectedRuntimeError, runtimeErrorLine, expectedExitCode };
}

function runOne(executable, path, test) {
  const failures = [];
  const result = spawnSync(executable, [path], { encoding: "utf8", cwd: ROOT });

  if (result.error) {
    failures.push(`Could not run ${executable}: ${result.error.message}`);
    return failures;
  }

  const outputLines = (result.stdout ?? "").split(/\r?\n/);
  const errorLines = (result.stderr ?? "").split(/\r?\n/);
  if (outputLines.length > 0 && outputLines[outputLines.length - 1] === "") outputLines.pop();

  if (test.expectedRuntimeError !== null) {
    validateRuntimeError(errorLines, test, failures);
  } else {
    validateCompileErrors(errorLines, test, failures);
  }

  validateExitCode(result.status, errorLines, test, failures);
  validateOutput(outputLines, test, failures);
  return failures;
}

function validateRuntimeError(errorLines, test, failures) {
  if (errorLines.length < 2 || (errorLines.length === 2 && errorLines[1] === "")) {
    failures.push(`Expected runtime error '${test.expectedRuntimeError}' and got none.`);
    return;
  }

  if (errorLines[0] !== test.expectedRuntimeError) {
    failures.push(`Expected runtime error '${test.expectedRuntimeError}' and got:`);
    failures.push(errorLines[0]);
  }

  let stackLine = null;
  for (const line of errorLines.slice(1)) {
    const m = STACK_TRACE_LINE.exec(line);
    if (m) {
      stackLine = Number(m[1]);
      break;
    }
  }

  if (stackLine === null) {
    failures.push(`Expected stack trace and got: ${errorLines.slice(1).join(" | ")}`);
  } else if (stackLine !== test.runtimeErrorLine) {
    failures.push(`Expected runtime error on line ${test.runtimeErrorLine} but was on line ${stackLine}.`);
  }
}

function validateCompileErrors(errorLines, test, failures) {
  const found = new Set();
  let unexpectedCount = 0;

  for (const line of errorLines) {
    const m = SYNTAX_ERROR.exec(line);
    if (m) {
      const error = `[${m[1]}] ${m[2]}`;
      if (test.expectedErrors.has(error)) {
        found.add(error);
      } else if (unexpectedCount < 10) {
        failures.push(`Unexpected error: ${line}`);
        unexpectedCount++;
      } else {
        unexpectedCount++;
      }
    } else if (line !== "") {
      if (unexpectedCount < 10) {
        failures.push(`Unexpected output on stderr: ${line}`);
      }
      unexpectedCount++;
    }
  }

  if (unexpectedCount > 10) failures.push(`(truncated ${unexpectedCount - 10} more...)`);

  for (const error of test.expectedErrors) {
    if (!found.has(error)) failures.push(`Missing expected error: ${error}`);
  }
}

function validateExitCode(exitCode, errorLines, test, failures) {
  if (exitCode === test.expectedExitCode) return;
  const shown = errorLines.length > 10 ? [...errorLines.slice(0, 10), "(truncated...)"] : errorLines;
  failures.push(`Expected return code ${test.expectedExitCode} and got ${exitCode}. Stderr: ${shown.join(" | ")}`);
}

function validateOutput(outputLines, test, failures) {
  let index = 0;
  for (; index < outputLines.length; index++) {
    const line = outputLines[index];
    if (index >= test.expectedOutput.length) {
      failures.push(`Got output '${line}' when none was expected.`);
      continue;
    }
    const expected = test.expectedOutput[index];
    if (expected.text !== line) {
      failures.push(`Expected output '${expected.text}' on line ${expected.line} and got '${line}'.`);
    }
  }
  while (index < test.expectedOutput.length) {
    const expected = test.expectedOutput[index];
    failures.push(`Missing expected output '${expected.text}' on line ${expected.line}.`);
    index++;
  }
}

function runSuite(name, executable, language) {
  if (!existsSync(executable)) {
    console.log(`=== ${name} ===`);
    console.log(`SKIPPED: ${relative(ROOT, executable)} does not exist yet. Build it first.`);
    return { name, passed: 0, failed: 0, skipped: 0, missingBinary: true };
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  console.log(`=== ${name} ===`);
  for (const path of walkLoxFiles(TEST_DIR)) {
    const rel = posix.normalize(relative(ROOT, path));
    if (rel.includes("benchmark/")) continue;

    const test = parseExpectations(path, language);
    if (test === null) {
      skipped++;
      continue;
    }
    if (test.error) {
      failed++;
      console.log(`TEST ERROR ${rel}: ${test.error}`);
      continue;
    }

    const failures = runOne(executable, path, test);
    if (failures.length === 0) {
      passed++;
    } else {
      failed++;
      console.log(`FAIL ${rel}`);
      for (const f of failures) console.log(`     ${f}`);
    }
  }

  if (failed === 0) {
    console.log(`All ${passed} tests passed (${skipped} skipped).`);
  } else {
    console.log(`${passed} passed, ${failed} failed, ${skipped} skipped.`);
  }

  return { name, passed, failed, skipped, missingBinary: false };
}

function main() {
  const mode = process.argv[2];

  if (!["vlox", "vloxvm", "chapters"].includes(mode)) {
    console.log("Usage: node tools/test.mjs <vlox|vloxvm|chapters>");
    return;
  }

  const results = [];

  if (mode === "vlox") {
    results.push(runSuite("vlox", join(ROOT, "build", "vlox"), "java"));
  } else if (mode === "vloxvm") {
    results.push(runSuite("vloxvm", join(ROOT, "build", "vloxvm"), "c"));
  } else {
    // chapters: every gen/<NN>-<slug> snapshot that build-chapters.mjs
    // managed to compile, in book order.
    const implChapters = chapters.filter((c) => c.impl);
    if (implChapters.length === 0) {
      console.log("No chapters declare a `impl` in web/src/data/toc.ts.");
      return;
    }
    for (const chapter of implChapters) {
      const dirs = existsSync(join(ROOT, "build", "chapters"))
        ? readdirSync(join(ROOT, "build", "chapters"))
        : [];
      const dirName = dirs.find((d) => d.endsWith(`-${chapter.slug}`));
      if (!dirName) continue; // no snapshot for this chapter -- nothing to test
      const language = chapter.impl === "vlox" ? "java" : "c";
      results.push(runSuite(dirName, join(ROOT, "build", "chapters", dirName), language));
    }
    if (results.length === 0) {
      console.log("No chapter snapshots found under build/chapters/. Run `just build-chapters` first.");
      return;
    }
  }

  const totalPassed = results.reduce((n, r) => n + r.passed, 0);
  const totalFailed = results.reduce((n, r) => n + r.failed, 0);
  const ran = results.filter((r) => !r.missingBinary).length;
  console.log(`\n${ran}/${results.length} suite(s) ran. ${totalPassed} passed, ${totalFailed} failed overall.`);
}

main();
