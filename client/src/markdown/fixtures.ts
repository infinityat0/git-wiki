/**
 * Test helper: read a markdown fixture from the shared corpus
 * (`test/fixtures/markdown/`). Resolved relative to this file so it works
 * regardless of the vitest working directory.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function readFixture(name: string): string {
  const url = new URL(
    '../../../test/fixtures/markdown/' + name,
    import.meta.url,
  );
  return readFileSync(fileURLToPath(url), 'utf8');
}
