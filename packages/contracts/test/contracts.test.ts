import { describe, it, expect } from 'vitest';
import {
  API_ROUTES,
  ERROR_CODES,
  contractsVersion,
  type ApiError,
  type AuthMe,
  type DocResponse,
  type HealthResponse,
  type HistoryEntry,
  type SearchResult,
  type SessionUser,
  type SyncResult,
  type TreeNode,
} from '@wiki/contracts';

// These assertions lock the runtime const maps to features spec §6 and prove
// `@wiki/contracts` resolves across the workspace boundary (value + type).

describe('API_ROUTES', () => {
  it('matches the exact paths in features spec §6', () => {
    expect(API_ROUTES).toStrictEqual({
      health: '/api/health',
      authMe: '/api/auth/me',
      authLogout: '/api/auth/logout',
      authDev: '/api/auth/dev',
      tree: '/api/tree',
      doc: '/api/doc',
      history: '/api/history',
      search: '/api/search',
      asset: '/api/asset',
      syncPull: '/api/sync/pull',
    });
  });
});

describe('ERROR_CODES', () => {
  it('is the exhaustive set from features spec §6.0', () => {
    expect(ERROR_CODES).toStrictEqual([
      'NOT_FOUND',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'CONFLICT',
      'SYNC_FAILED',
      'VALIDATION',
      'INTERNAL',
    ]);
  });
});

it('exports a version marker', () => {
  expect(typeof contractsVersion).toBe('string');
});

// Type-shape smoke checks: these fail to compile if a field diverges from the
// spec JSON, and assert the representative examples from features spec §6.
describe('payload shapes match spec JSON examples', () => {
  it('TreeNode (nested directory)', () => {
    const node: TreeNode = {
      name: 'adr',
      path: 'adr',
      title: 'Architecture Decisions',
      type: 'directory',
      order: 10,
      children: [
        {
          name: '0001-architecture-overview.md',
          path: 'adr/0001-architecture-overview.md',
          title: 'Architecture Overview',
          order: 1,
          type: 'file',
        },
      ],
    };
    expect(node.children?.[0]?.type).toBe('file');
  });

  it('DocResponse', () => {
    const doc: DocResponse = {
      path: 'adr/0001-architecture-overview.md',
      content: '# Architecture Overview\n...',
      lastModified: '2026-08-18T05:22:15Z',
    };
    expect(doc.path).toContain('adr/');
  });

  it('HistoryEntry', () => {
    const entry: HistoryEntry = {
      hash: '568d7c2a71bf62bf62c129bd95eeec0216508933',
      author: 'Sunny',
      date: '2026-08-17T22:32:31-07:00',
      message: 'Initial docs commit',
    };
    expect(entry.hash).toHaveLength(40);
  });

  it('SearchResult', () => {
    const hit: SearchResult = {
      path: 'adr/0001-architecture-overview.md',
      title: 'Architecture Overview',
      matches: ['...Vite frontend and Express backend...'],
    };
    expect(hit.matches).toHaveLength(1);
  });

  it('AuthMe authenticated + read-only firebase user', () => {
    const user: SessionUser = {
      name: 'Ada Lovelace',
      email: 'user@tapestry.app',
      provider: 'firebase',
      canWrite: false,
    };
    const me: AuthMe = { authenticated: true, user };
    const anon: AuthMe = { authenticated: false };
    expect(me.user?.canWrite).toBe(false);
    expect(anon.user).toBeUndefined();
  });

  it('HealthResponse', () => {
    const health: HealthResponse = {
      status: 'ok',
      searchIndex: 'building',
      docsRepo: 'syncing',
    };
    expect(health.status).toBe('ok');
  });

  it('SyncResult', () => {
    const sync: SyncResult = {
      success: true,
      changesPulled: false,
      log: 'Already up to date.',
    };
    expect(sync.changesPulled).toBe(false);
  });

  it('ApiError', () => {
    const err: ApiError = { error: { code: 'NOT_FOUND', message: 'missing' } };
    expect(ERROR_CODES).toContain(err.error.code);
  });
});
