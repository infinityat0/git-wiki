/**
 * F8 — coverage guard.
 *
 * The mechanism that makes "every markdown element is tested" true by
 * construction (testing-markdown-rendering.md §"Coverage-guard test"). It reads
 * the hand-maintained `SPEC_ELEMENTS` checklist and the fixture `manifest.json`
 * and, for every spec element, asserts:
 *
 *   (a) a manifest entry exists,
 *   (b) its fixture `.md` file exists on disk,
 *   (c) it declares at least one DOM/structure assertion.
 *
 * It ALSO fails if the manifest lists an element that isn't in `SPEC_ELEMENTS`
 * (drift in the other direction), and checks the security counter-fixtures.
 *
 * INTENTIONAL SCOPE: this guard verifies FIXTURE + MANIFEST coverage only. It
 * does NOT assert that a light/dark L3 baseline exists — baselines are committed
 * incrementally as each `R*` render task lands, so a baseline-existence gate
 * would be red today for every not-yet-built element. Each `R*` card owns its
 * own baseline; when the render work is complete a stricter guard can be added.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { SPEC_ELEMENTS } from './spec-elements.js';

interface ManifestElement {
  id: string;
  specLabel?: string;
  fixture: string;
  visual?: boolean;
  assertions?: string[];
}

interface ManifestSecurity {
  id: string;
  fixture: string;
  expectBlocked: string;
}

interface Manifest {
  elements: ManifestElement[];
  security: ManifestSecurity[];
}

// Resolved from the Vitest root (repo root) — see the note in harness.ts.
const FIXTURES_DIR = resolve(process.cwd(), 'test/fixtures/markdown');

function fixturePath(fixture: string): string {
  return resolve(FIXTURES_DIR, fixture);
}

const manifest = JSON.parse(
  readFileSync(fixturePath('manifest.json'), 'utf8'),
) as Manifest;

describe('coverage guard: every spec element has a fixture + manifest entry', () => {
  for (const id of SPEC_ELEMENTS) {
    describe(`element "${id}"`, () => {
      const entry = manifest.elements.find((e) => e.id === id);

      test('has a manifest entry', () => {
        expect(entry, `no manifest entry for spec element "${id}"`).toBeDefined();
      });

      test('has a fixture file on disk', () => {
        expect(entry).toBeDefined();
        expect(
          existsSync(fixturePath(entry!.fixture)),
          `fixture "${entry!.fixture}" for "${id}" is missing on disk`,
        ).toBe(true);
      });

      test('declares at least one assertion', () => {
        expect(entry).toBeDefined();
        expect(
          (entry!.assertions ?? []).length,
          `manifest element "${id}" declares no assertions`,
        ).toBeGreaterThan(0);
      });
    });
  }
});

describe('coverage guard: manifest does not drift ahead of the spec checklist', () => {
  for (const entry of manifest.elements) {
    test(`manifest element "${entry.id}" is in SPEC_ELEMENTS`, () => {
      expect(
        (SPEC_ELEMENTS as readonly string[]).includes(entry.id),
        `manifest lists "${entry.id}" but it is not in SPEC_ELEMENTS — add it to spec-elements.ts`,
      ).toBe(true);
    });
  }
});

describe('coverage guard: security counter-fixtures exist', () => {
  for (const sec of manifest.security) {
    test(`security fixture "${sec.id}" exists on disk`, () => {
      expect(
        existsSync(fixturePath(sec.fixture)),
        `security fixture "${sec.fixture}" is missing on disk`,
      ).toBe(true);
      expect(sec.expectBlocked.length).toBeGreaterThan(0);
    });
  }
});
