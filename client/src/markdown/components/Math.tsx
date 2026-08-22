import 'katex/dist/katex.min.css';
import './Math.css';

/**
 * R3 — Math (KaTeX) Component & Styling.
 *
 * Math rendering is performed in the unified AST pipeline via `remark-math`
 * and `rehype-katex` (post-sanitize stage). KaTeX CSS and styling assets are
 * bundled locally without runtime script dependencies.
 */
export function MathStyles() {
  return null;
}

export default MathStyles;
