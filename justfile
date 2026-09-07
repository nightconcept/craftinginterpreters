# Crafting Interpreters in V. Run `just` to list all recipes.

default:
    @just --list

# --- vlox: the tree-walk interpreter (Part II) ---

# Build vlox into build/vlox.
build-vlox:
    @mkdir -p build
    v -o build/vlox vlox/src

# Run the vlox REPL.
run-vlox: build-vlox
    ./build/vlox

# Run one Lox script with vlox. Usage: just run-file-vlox test/print/missing_argument.lox
run-file-vlox file: build-vlox
    ./build/vlox {{file}}

# --- vloxvm: the bytecode virtual machine (Part III) ---

# Build vloxvm into build/vloxvm.
build-vloxvm:
    @mkdir -p build
    v -o build/vloxvm vloxvm/src

# Run the vloxvm REPL.
run-vloxvm: build-vloxvm
    ./build/vloxvm

# --- chapter snapshots ---

# Generate a compilable V snapshot of every chapter into gen/.
split:
    node tools/split-chapters.mjs

# Compile every generated chapter snapshot.
build-chapters: split
    node tools/build-chapters.mjs

# --- tests ---

# Run the Lox test corpus against the final vlox build.
test-vlox: build-vlox
    node tools/test.mjs vlox

# Run the Lox test corpus against the final vloxvm build.
test-vloxvm: build-vloxvm
    node tools/test.mjs vloxvm

# Run the Lox test corpus against every chapter snapshot.
test-chapters: build-chapters
    node tools/test.mjs chapters

# Run every test suite.
test: test-vlox test-vloxvm

# --- the book site ---

# Install the Astro dependencies.
web-install:
    cd web && pnpm install

# Serve the book at http://localhost:4321 with live reload.
serve: web-install
    cd web && pnpm run dev

# Build the static site into web/dist.
book: web-install
    cd web && pnpm run build

# --- housekeeping ---

# Format the V sources.
fmt:
    v fmt -w vlox/src vloxvm/src

# Check formatting and vet the V sources.
lint:
    v fmt -verify vlox/src vloxvm/src
    v vet vlox/src vloxvm/src

# Remove all build outputs.
clean:
    rm -rf build gen web/dist web/.astro
