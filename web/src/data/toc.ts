// The book's structure, mirroring the table of contents in Nystrom's
// tool/lib/src/book.dart. Order matters: it drives chapter numbering and the
// previous/next links.

export interface Chapter {
  title: string;
  slug: string;
  /** The V implementation a chapter's code belongs to, if any. */
  impl?: "vlox" | "vloxvm";
}

export interface Part {
  title: string;
  slug?: string;
  chapters: Chapter[];
}

export const parts: Part[] = [
  {
    title: "",
    chapters: [
      { title: "Crafting Interpreters", slug: "index" },
      { title: "Dedication", slug: "dedication" },
      { title: "Acknowledgements", slug: "acknowledgements" },
      { title: "Table of Contents", slug: "contents" },
    ],
  },
  {
    title: "Welcome",
    slug: "welcome",
    chapters: [
      { title: "Introduction", slug: "introduction" },
      { title: "A Map of the Territory", slug: "a-map-of-the-territory" },
      { title: "The Lox Language", slug: "the-lox-language" },
    ],
  },
  {
    title: "A Tree-Walk Interpreter",
    slug: "a-tree-walk-interpreter",
    chapters: [
      { title: "Scanning", slug: "scanning", impl: "vlox" },
      { title: "Representing Code", slug: "representing-code", impl: "vlox" },
      { title: "Parsing Expressions", slug: "parsing-expressions", impl: "vlox" },
      { title: "Evaluating Expressions", slug: "evaluating-expressions", impl: "vlox" },
      { title: "Statements and State", slug: "statements-and-state", impl: "vlox" },
      { title: "Control Flow", slug: "control-flow", impl: "vlox" },
      { title: "Functions", slug: "functions", impl: "vlox" },
      { title: "Resolving and Binding", slug: "resolving-and-binding", impl: "vlox" },
      { title: "Classes", slug: "classes", impl: "vlox" },
      { title: "Inheritance", slug: "inheritance", impl: "vlox" },
    ],
  },
  {
    title: "A Bytecode Virtual Machine",
    slug: "a-bytecode-virtual-machine",
    chapters: [
      { title: "Chunks of Bytecode", slug: "chunks-of-bytecode", impl: "vloxvm" },
      { title: "A Virtual Machine", slug: "a-virtual-machine", impl: "vloxvm" },
      { title: "Scanning on Demand", slug: "scanning-on-demand", impl: "vloxvm" },
      { title: "Compiling Expressions", slug: "compiling-expressions", impl: "vloxvm" },
      { title: "Types of Values", slug: "types-of-values", impl: "vloxvm" },
      { title: "Strings", slug: "strings", impl: "vloxvm" },
      { title: "Hash Tables", slug: "hash-tables", impl: "vloxvm" },
      { title: "Global Variables", slug: "global-variables", impl: "vloxvm" },
      { title: "Local Variables", slug: "local-variables", impl: "vloxvm" },
      { title: "Jumping Back and Forth", slug: "jumping-back-and-forth", impl: "vloxvm" },
      { title: "Calls and Functions", slug: "calls-and-functions", impl: "vloxvm" },
      { title: "Closures", slug: "closures", impl: "vloxvm" },
      { title: "Garbage Collection", slug: "garbage-collection", impl: "vloxvm" },
      { title: "Classes and Instances", slug: "classes-and-instances", impl: "vloxvm" },
      { title: "Methods and Initializers", slug: "methods-and-initializers", impl: "vloxvm" },
      { title: "Superclasses", slug: "superclasses", impl: "vloxvm" },
      { title: "Optimization", slug: "optimization", impl: "vloxvm" },
    ],
  },
  {
    title: "Backmatter",
    slug: "backmatter",
    chapters: [
      { title: "Appendix I", slug: "appendix-i" },
      { title: "Appendix II", slug: "appendix-ii" },
    ],
  },
];

/** Every chapter in reading order. */
export const chapters = parts.flatMap((part) => part.chapters);

const numbered = parts
  .filter((p) => p.title !== "" && p.title !== "Backmatter")
  .flatMap((p) => p.chapters);

export function chapterNumber(slug: string): string {
  if (slug === "appendix-i") return "A1";
  if (slug === "appendix-ii") return "A2";
  const i = numbered.findIndex((c) => c.slug === slug);
  return i === -1 ? "" : String(i + 1);
}

export function adjacent(slug: string) {
  const i = chapters.findIndex((c) => c.slug === slug);
  return {
    prev: i > 0 ? chapters[i - 1] : undefined,
    next: i >= 0 && i < chapters.length - 1 ? chapters[i + 1] : undefined,
  };
}

export function titleFor(slug: string): string {
  return chapters.find((c) => c.slug === slug)?.title ?? slug;
}
