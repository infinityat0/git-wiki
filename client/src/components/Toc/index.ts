/**
 * U2 — public surface of the right-hand table of contents.
 *
 * The integrator mounts {@link Toc} in the Shell's right zone (desktop) and
 * feeds it the H2/H3 `entries` that U3's `AppRoutes` forwards from the F7
 * `<Markdown onTocChange>` callback.
 */

export { Toc, default as TocDefault } from './Toc.js';
export type { TocProps } from './Toc.js';
