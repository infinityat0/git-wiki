/**
 * U3 — the three async states of the document surface (features spec §10).
 *
 *   Loading → content skeleton (title + lines)
 *   Error   → "Couldn't load this doc" + retry
 *   404     → in-app not-found view for an unknown route (never a blank page)
 *
 * These are presentation-only; `DocView` decides which to show from the
 * `useDoc` / tree status. Kept in one file so the states read as a set.
 */

/** Loading skeleton: a title bar plus several text lines (features spec §10). */
export function DocSkeleton() {
  return (
    <div
      className="docview-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading document"
      data-testid="docview-skeleton"
    >
      <div className="docview-skeleton__bar docview-skeleton__bar--title" />
      {[80, 95, 88, 70, 92, 60].map((width, i) => (
        <div
          key={i}
          className="docview-skeleton__bar"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}

/** In-app 404 for an unknown route (features spec §9, §10). */
export function DocNotFound({ path }: { path: string }) {
  return (
    <div className="docview-status" role="alert" data-testid="docview-notfound">
      <p className="docview-status__code">404</p>
      <h1 className="docview-status__title">Page not found</h1>
      <p className="docview-status__detail">
        {path ? `No document exists at “${path}”.` : 'No document is selected.'}
      </p>
    </div>
  );
}

/** Error state with a retry action (features spec §10). */
export function DocError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="docview-status" role="alert" data-testid="docview-error">
      <h1 className="docview-status__title">Couldn&rsquo;t load this doc</h1>
      {message ? <p className="docview-status__detail">{message}</p> : null}
      <button type="button" className="docview-status__retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
