/**
 * U3 — public surface of the routing layer.
 *
 * Consumers:
 *   - The integrator mounts {@link AppRoutes} in the Shell content zone.
 *   - U1 (sidebar), U4 (search), U5 (header) turn a tree/search `path` into a
 *     navigable route with {@link docPathToRoute} (feed it to a `<Link to>` or
 *     `navigate()`), and read the active doc via react-router's own hooks.
 *   - R6 (`MdLink`) receives the {@link DocExists} predicate — U3 wires it from
 *     the tree inside `DocView`; {@link useDocExists} exposes it standalone.
 */

export { AppRoutes, default as AppRoutesDefault } from './AppRoutes.js';
export type { AppRoutesProps } from './AppRoutes.js';

export { DocView } from '../components/DocView/DocView.js';
export type { DocViewProps } from '../components/DocView/DocView.js';

export { docPathToRoute, routeToDocPath, docDirname } from './paths.js';

export {
  makeDocExists,
  isKnownMissing,
  useDocExists,
  type DocExists,
} from './docExists.js';

export { useInternalLinkNav } from './useInternalLinkNav.js';
