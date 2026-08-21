/**
 * U6 — public surface of the git history drawer.
 *
 * The integrator mounts {@link HistoryDrawer} at the Shell, owning its `isOpen`
 * state and supplying the active doc `path` (derived from the route via U3's
 * `routeToDocPath`).
 */

export {
  HistoryDrawer,
  default as HistoryDrawerDefault,
} from './HistoryDrawer.js';
export type { HistoryDrawerProps } from './HistoryDrawer.js';
