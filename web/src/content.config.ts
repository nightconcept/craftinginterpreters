import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// The book's Markdown stays where Nystrom put it, at the repository root.
// Nothing in `book/` is copied into `web/`, so his prose has exactly one home.
const book = defineCollection({
  loader: glob({ base: "../book", pattern: "**/*.md" }),
  schema: z.object({}).passthrough(),
});

export const collections = { book };
