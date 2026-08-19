# L3 visual regression (Playwright)

The `R*` render tasks assert rendered **pixels** here, in light and dark, against
committed baselines under `__screenshots__/`. Config lives in the repo-root
[`playwright.config.ts`](../../playwright.config.ts); the harness that renders a
fixture through F7's `<Markdown>` is in [`harness/`](./harness).

## Why baselines are generated in a container

Font rasterization is OS-specific, so a baseline shot on macOS will not match a
CI run on Linux. To keep them identical, **both** the committed baselines and CI
run inside the same pinned Playwright image:

```
mcr.microsoft.com/playwright:v1.62.1-noble   # matches @playwright/test 1.62.1
```

`@playwright/test` is pinned to an exact version in the root `package.json` so
the image tag and the library never drift. Bump both together.

## Regenerating baselines (the reviewed `--update-snapshots` step)

Never let CI auto-write baselines. Regenerate deliberately, in the container, and
review the PNG diff in the PR:

```bash
# from the repo root
docker run --rm -it \
  -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -lc "npm ci && npx playwright test --update-snapshots"
```

(That mounts the repo, so it reinstalls `node_modules` for Linux — run
`npm install` again afterwards to restore your host binaries. The F8 baselines
were generated with the copy-in variant to avoid touching host `node_modules`.)

Locally, without Docker, you can iterate with `npx playwright test` after
`npx playwright install chromium` — but do **not** commit host-generated
baselines; they will fail the Linux CI compare.

## Adding an element (what each `R*` does)

1. Copy [`headings.spec.ts`](./headings.spec.ts) to `test/visual/<element>.spec.ts`
   and change the fixture id (a `manifest.json` element id).
2. Tag any dynamic region (timestamp, git hash) with `data-mask` so the spec's
   `mask` hook hides it.
3. Regenerate the light + dark baseline with the container command above; commit
   the two PNGs.

The L1 (DOM) + L2 (snapshot) halves live in
[`test/unit/render/`](../unit/render); see `headings.test.tsx` for the pattern
and `harness.ts` for the `renderFixture` API.
