/**
 * remark-image-path
 *
 * Nystrom's prose references illustrations with a root-relative-looking but
 * actually relative path:
 *
 *   <img src="image/scanning/lexemes.png" alt="..." />
 *
 * His site serves every chapter from `/`, so that path resolves. This site
 * serves chapters from `/<base>/<slug>/`, so the same path 404s. The prose
 * in `book/` stays byte-identical, so this plugin rewrites the `src` at
 * build time to point at `<base>/image/...`, where the files are published
 * from `web/public/image` (a symlink to `site/image`).
 */
import { visit } from "unist-util-visit";

export default function remarkImagePath({ base = "" } = {}) {
  const prefix = base.replace(/\/+$/, "");
  return (tree) => {
    visit(tree, "html", (node) => {
      node.value = node.value.replace(
        /(<img\b[^>]*?\bsrc=")image\//g,
        (_, before) => `${before}${prefix}/image/`,
      );
    });
  };
}
