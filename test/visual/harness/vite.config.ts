import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * F8 — Vite dev server for the L3 visual harness. Playwright launches this via
 * its `webServer` config. Root is this harness dir; `fs.allow` is widened to the
 * repo root so the harness can import both the F7 pipeline (`client/src`) and
 * the shared fixture corpus (`test/fixtures`).
 */
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const harnessRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: harnessRoot,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5199,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
});
