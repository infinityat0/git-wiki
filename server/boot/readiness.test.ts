import { describe, expect, it } from 'vitest';

import { ReadinessRegistry } from './readiness.js';

describe('ReadinessRegistry', () => {
  it('starts building, clean, and not-ready', () => {
    const reg = new ReadinessRegistry();
    expect(reg.searchIndex).toBe('building');
    expect(reg.docsRepo).toBe('clean');
    expect(reg.repoPresent).toBe(false);
    expect(reg.isReady()).toBe(false);
    expect(reg.snapshot()).toEqual({
      status: 'ok',
      searchIndex: 'building',
      docsRepo: 'clean',
    });
  });

  it('is ready only once the clone is present AND the index is built', () => {
    const reg = new ReadinessRegistry();

    reg.markRepoPresent();
    expect(reg.isReady()).toBe(false); // index still building

    reg.setSearchIndex('ready');
    expect(reg.isReady()).toBe(true);
  });

  it('is not ready when the index is ready but the clone is absent', () => {
    const reg = new ReadinessRegistry();
    reg.setSearchIndex('ready');
    expect(reg.repoPresent).toBe(false);
    expect(reg.isReady()).toBe(false);
  });

  it('reflects docs-repo transitions in the snapshot', () => {
    const reg = new ReadinessRegistry();
    reg.setDocsRepo('syncing');
    expect(reg.snapshot().docsRepo).toBe('syncing');
    reg.setDocsRepo('clean');
    expect(reg.snapshot().docsRepo).toBe('clean');
  });
});
