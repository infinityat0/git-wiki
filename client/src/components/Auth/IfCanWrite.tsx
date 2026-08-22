/*
 * U7 — client-side write gate (features spec §12; ADR-0005).
 *
 * Renders its children only when the current session may write (`useCanWrite`),
 * used to show/hide edit affordances. This is **UI only** — never a security
 * boundary. The backend independently re-checks `canWrite` on every write
 * endpoint (a Firebase/read-only session is rejected server-side), so hiding a
 * button here is convenience, not enforcement.
 */

import type { ReactNode } from 'react';
import { useCanWrite } from '../../stores/index.js';

export interface IfCanWriteProps {
  /** Edit affordance(s) shown only to writers. */
  children: ReactNode;
  /** Optional content rendered for read-only sessions (defaults to nothing). */
  fallback?: ReactNode;
}

export function IfCanWrite({ children, fallback = null }: IfCanWriteProps) {
  const canWrite = useCanWrite();
  return <>{canWrite ? children : fallback}</>;
}

export default IfCanWrite;
