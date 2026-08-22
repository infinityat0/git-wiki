/**
 * Document, history and search payload contracts (features spec §6.2).
 */

/** Response of `GET /api/doc?path=<relative_path>` (features spec §6.2). */
export interface DocResponse {
  /** Path relative to `repo-cache/`, echoing the requested `path`. */
  path: string;
  /** Raw markdown source (unrendered). */
  content: string;
  /** Last-modified timestamp, ISO 8601 (e.g. `2026-08-18T05:22:15Z`). */
  lastModified: string;
}

/** A single commit in a file's history (`GET /api/history`, features spec §6.2). */
export interface HistoryEntry {
  /** Full commit SHA. */
  hash: string;
  /** Commit author name. */
  author: string;
  /** Author date, ISO 8601 with offset (e.g. `2026-08-17T22:32:31-07:00`). */
  date: string;
  /** Commit subject/message. */
  message: string;
}

/** Response of `GET /api/history?path=<relative_path>`. */
export type HistoryResponse = HistoryEntry[];

/** A single full-text search hit (`GET /api/search`, features spec §6.2). */
export interface SearchResult {
  /** Path relative to `repo-cache/`; maps to an SPA route (features spec §9). */
  path: string;
  /** Resolved document title (features spec §7). */
  title: string;
  /** Matching snippet(s) with surrounding context. */
  matches: string[];
}

/** Response of `GET /api/search?q=<query>`. */
export type SearchResponse = SearchResult[];
