/**
 * U6 — the three async states of the git history drawer (features spec §10,
 * Design.md §6).
 *
 *   Loading → shimmering skeleton list of commit rows
 *   Empty   → "No history" for a doc with no recorded commits
 *   Error   → inline retry banner
 *
 * Presentation-only; `HistoryDrawer` chooses which to show from the
 * `useHistory` status. Kept together so the state set reads as a group,
 * mirroring `SidebarStates` (U1) and `DocStates` (U3).
 */

/** Skeleton commit rows shown while the history request is in flight. */
export function HistorySkeleton() {
  return (
    <div
      className="history__skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading history"
      data-testid="history-skeleton"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="history__skeleton-row">
          <div className="history__skeleton-line history__skeleton-line--meta" />
          <div className="history__skeleton-line history__skeleton-line--msg" />
        </div>
      ))}
    </div>
  );
}

/** Empty state: the document has no recorded commit history (features spec §10). */
export function HistoryEmpty() {
  return (
    <div className="history__status" data-testid="history-empty">
      <p className="history__status-title">No history</p>
      <p className="history__status-detail">
        No commits were found for this document.
      </p>
    </div>
  );
}

/** Error state with a retry action (features spec §10). */
export function HistoryError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="history__status" role="alert" data-testid="history-error">
      <p className="history__status-title">Couldn&rsquo;t load history</p>
      {message ? <p className="history__status-detail">{message}</p> : null}
      <button type="button" className="history__status-retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
