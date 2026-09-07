import { defineConfig } from "astro/config";
import remarkCodeTag from "./plugins/remark-code-tag.mjs";
import remarkAside from "./plugins/remark-aside.mjs";

// The repository is published at https://nightconcept.github.io/craftinginterpreters/
// so the site lives under a base path. Change `base` to "/" for a custom domain.
export default defineConfig({
  site: "https://nightconcept.github.io",
  base: "/craftinginterpreters",
  trailingSlash: "always",
  markdown: {
    // remarkCodeTag must run before any plugin that reads code blocks,
    // because it is what creates them from `^code` directives.
    remarkPlugins: [remarkCodeTag, remarkAside],
    syntaxHighlight: "shiki",
    shikiConfig: {
      // V has no upstream Shiki grammar. `go` is the closest match for
      // V syntax; replace with a bundled TextMate grammar when one exists.
      langAlias: { v: "go" },
      themes: { light: "github-light", dark: "github-dark" },
    },
  },
});
