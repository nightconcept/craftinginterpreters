import { defineConfig } from "astro/config";
import remarkCodeTag from "./plugins/remark-code-tag.mjs";
import remarkAside from "./plugins/remark-aside.mjs";
import remarkImagePath from "./plugins/remark-image-path.mjs";
import loxGrammar from "./grammars/lox.tmLanguage.json" with { type: "json" };
import vGrammar from "./grammars/v.tmLanguage.json" with { type: "json" };

// The repository is published at https://nightconcept.github.io/craftinginterpreters/
// so the site lives under a base path. Change `base` to "/" for a custom domain.
const base = "/craftinginterpreters";

export default defineConfig({
  site: "https://nightconcept.github.io",
  base,
  trailingSlash: "always",
  markdown: {
    // remarkCodeTag must run before any plugin that reads code blocks,
    // because it is what creates them from `^code` directives.
    remarkPlugins: [remarkCodeTag, remarkAside, [remarkImagePath, { base }]],
    syntaxHighlight: "shiki",
    shikiConfig: {
      // Neither V nor Lox has an upstream Shiki grammar; both are bundled
      // minimal TextMate grammars in `grammars/`.
      langs: [loxGrammar, vGrammar],
      themes: { light: "github-light", dark: "github-dark" },
    },
  },
});
