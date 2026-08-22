/**
 * U1 — public surface of the left sidebar navigation tree.
 *
 * The integrator mounts {@link Sidebar} in the Shell's left zone (desktop) and,
 * on mobile, drives it as a drawer via the controlled `isOpen` / `onClose`
 * props (see {@link SidebarProps}).
 */

export { Sidebar, default as SidebarDefault } from './Sidebar.js';
export type { SidebarProps } from './Sidebar.js';
