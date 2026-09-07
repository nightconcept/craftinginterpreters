/**
 * remark-aside
 *
 * Nystrom writes margin notes as a named anchor in the prose paired with a
 * block later in the file:
 *
 *   The first step in any compiler is <span name="lexing">scanning</span>.
 *
 *   <aside name="lexing">
 *   ...
 *   </aside>
 *
 * The prose stays exactly as written. This plugin only adds the hooks that
 * the stylesheet and the alignment script need:
 *
 *   - every `<aside name="x">` gains `class="aside" data-aside="x"`
 *   - every `<span name="x">` gains `class="aside-anchor" data-anchor="x"`
 *
 * Vertical alignment of an aside with its anchor happens at runtime in
 * Chapter.astro, because it depends on the rendered line height.
 */
import { visit } from "unist-util-visit";

const ASIDE_OPEN = /<aside\s+name="([^"]+)"/g;
const SPAN_OPEN = /<span\s+name="([^"]+)"/g;

export default function remarkAside() {
  return (tree) => {
    visit(tree, ["html", "text"], (node) => {
      if (node.type !== "html") return;
      node.value = node.value
        .replace(ASIDE_OPEN, (_, name) =>
          `<aside class="aside" data-aside="${name}"`)
        .replace(SPAN_OPEN, (_, name) =>
          `<span class="aside-anchor" data-anchor="${name}"`);
    });
  };
}
