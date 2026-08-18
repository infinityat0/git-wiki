# B5 — `GET /api/history?path=`

**Area:** backend · **Milestone:** M2 · **Depends on:** F2, F4 · **Parallel-safe with:** all other `B*`

## Scope
- Validate `path` (F4). Run `git log --follow --pretty=… -- <file>` via `execFile` (note the `--` separator so a `-`-prefixed filename can't be read as a flag).
- Map to `HistoryEntry[]` (`hash`, `author`, `date`, `message`). Paginate/limit.

## Owns
- `server/routes/history.ts`.

## Acceptance
- Returns entries for a tracked file; empty array for an untracked one. Includes a git-arg-injection test (filename starting with `-`).

## Read first
- [features spec §6.2](../../specs/wiki-features-specification.md) · [security-and-safety.md §2](../../specs/security-and-safety.md).
