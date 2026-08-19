import { defineConfig, configDefaults } from 'vitest/config';

/**
 * F8 — root Vitest config for the markdown-rendering test harness.
 *
 * Discovery matches the pre-F8 default (client/server/packages `*.test.*`),
 * plus the new render suite under `test/unit/render/**`. Two deliberate deltas:
 *
 *  - `test/visual/**` is excluded — those are Playwright L3 specs (`*.spec.ts`)
 *    and must never be collected by Vitest.
 *  - `test/unit/render/**` runs under jsdom (L1 DOM + L2 snapshot need a DOM);
 *    everything else keeps the default `node` environment. Individual files may
 *    still pin their own env with a `// @vitest-environment` directive, exactly
 *    as the existing F7 `client/src/markdown/*.tsx` tests already do.
 */
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['test/unit/render/**', 'jsdom']],
    exclude: [...configDefaults.exclude, 'test/visual/**', '.claude/**'],
  },
});
