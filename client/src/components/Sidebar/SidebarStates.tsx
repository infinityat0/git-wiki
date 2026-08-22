/**
 * U1 — the three async states of the sidebar tree (features spec §10).
 *
 *   Loading → shimmering skeleton rows
 *   Empty   → "No documents yet" with a sync hint
 *   Error   → inline retry banner
 *
 * Presentation-only; `Sidebar` chooses which to show from the `useTree` status.
 * Kept together so the state set reads as a group, mirroring `DocStates` (U3).
 */

/** Skeleton rows shown while the tree request is in flight (features spec §10). */
export function SidebarSkeleton() {
  return (
    <div
      className="sidebar-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading navigation"
      data-testid="sidebar-skeleton"
    >
      {[92, 70, 80, 64, 86, 58, 74].map((width, i) => (
        <div
          key={i}
          className="sidebar-skeleton__row"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}

/** Empty state: no documents in the repo yet (features spec §10). */
export function SidebarEmpty() {
  return (
    <div className="sidebar-status" data-testid="sidebar-empty">
      <p className="sidebar-status__title">No documents yet</p>
      <p className="sidebar-status__detail">
        Sync the repository to populate the navigation.
      </p>
    </div>
  );
}

/** Error state with a retry action (features spec §10). */
export function SidebarError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="sidebar-status" role="alert" data-testid="sidebar-error">
      <p className="sidebar-status__title">Couldn&rsquo;t load navigation</p>
      {message ? <p className="sidebar-status__detail">{message}</p> : null}
      <button type="button" className="sidebar-status__retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
