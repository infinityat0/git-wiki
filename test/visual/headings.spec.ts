import { test, expect } from '@playwright/test';

/**
 * F8 worked example — `headings` at L3 (visual regression), light + dark.
 *
 * This is the reference an `R*` render task copies for its own element: render
 * the fixture through the harness, wait for fonts + first heading, then compare
 * against the committed baseline in both themes. `headings` renders fully
 * through F7's pipeline today, so it proves the visual machinery end-to-end.
 *
 * To add a new element, copy this file as `test/visual/<element>.spec.ts`,
 * change the fixture id, and generate the baseline (see `test/visual/README.md`).
 */
const THEMES = ['light', 'dark'] as const;

for (const theme of THEMES) {
  test(`headings — ${theme}`, async ({ page }) => {
    await page.goto(`/?fixture=headings&theme=${theme}`);

    // Structure is up before we compare pixels...
    await page.waitForSelector('[data-testid="markdown-root"] h1');
    // ...and the bundled fonts are fully swapped in (no FOUT in the baseline).
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot(`headings-${theme}.png`, {
      fullPage: true,
      // Dynamic regions (timestamps, git hashes) are masked by tagging them
      // `data-mask`; `headings` has none, but every spec wires the same hook so
      // R* elements that carry them stay deterministic.
      mask: [page.locator('[data-mask]')],
    });
  });
}
