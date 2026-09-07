# Testing

## The corpus

`test/` holds 265 Lox scripts. They came from upstream unchanged and they
are language-agnostic: they test Lox behaviour, not Java or C or V.

Each script states its own expectations in comments:

```lox
print 1 + 2; // expect: 3
```

Other forms cover compile errors, runtime errors, and the line a failure
must report. `tools/test.mjs` parses those comments, runs the binary, and
diffs actual output against expected output.

## Commands

| Command | Runs |
| --- | --- |
| `just test-vlox` | The corpus against the finished tree-walk interpreter |
| `just test-vloxvm` | The corpus against the finished virtual machine |
| `just test-chapters` | The corpus against every chapter snapshot |
| `just test` | Both finished implementations |

## Per-chapter testing

`just test-chapters` builds `gen/NN-slug/` for every chapter and runs the
subset of tests that the chapter has earned. This is the main feedback loop
while you work through the book.

Early on, most chapters fail because nothing is translated yet. That is
expected. The tools report a summary and exit 0 rather than stopping at the
first failure, so the report stays useful.

Read the summary as a progress bar, not as a pass or fail gate.

## What a failure means

| Symptom | Likely cause |
| --- | --- |
| A chapter snapshot does not compile | A snippet marker opens and never closes |
| A snapshot compiles but the chapter after it does not | The mistake is in the later chapter |
| The book shows the wrong lines for a `^code` | The marker range is wrong, or the tag needs the diff model |
| Every test fails with no output | The binary was not built |

See [Snippets](snippets.md) for the marker rules and
[Architecture](architecture.md) for how snapshots are produced.
