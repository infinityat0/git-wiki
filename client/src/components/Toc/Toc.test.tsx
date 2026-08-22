// @vitest-environment jsdom
/**
 * U2 — `Toc` right table of contents + scroll-spy (Design.md §2, features spec
 * §2.2, §9).
 *
 * Covers the behaviours the card calls out: it renders the H2/H3 entries with
 * their depth indentation; clicking an item scrolls to the heading and sets the
 * URL hash; and the active highlight tracks scroll via a mocked
 * `IntersectionObserver`. Empty input renders nothing.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { TocEntry } from '../../markdown/index.js';
import { Toc } from './Toc.js';

const ENTRIES: TocEntry[] = [
  { id: 'intro', text: 'Introduction', depth: 2 },
  { id: 'details', text: 'Fine Details', depth: 3 },
  { id: 'usage', text: 'Usage', depth: 2 },
];

/** A controllable stand-in for the real IntersectionObserver. */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  readonly observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Fire the observer callback with synthetic records. */
  fire(records: Array<{ id: string; isIntersecting: boolean }>) {
    const entries = records.map(
      ({ id, isIntersecting }) =>
        ({
          target: document.getElementById(id) as Element,
          isIntersecting,
        }) as IntersectionObserverEntry,
    );
    act(() => {
      this.callback(entries, this as unknown as IntersectionObserver);
    });
  }
}

/** Insert real heading elements so `document.getElementById` finds them. */
function mountHeadings(entries: TocEntry[]) {
  for (const e of entries) {
    const h = document.createElement(`h${e.depth}`);
    h.id = e.id;
    h.textContent = e.text;
    document.body.appendChild(h);
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  // jsdom does not implement scrollIntoView.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Toc', () => {
  test('renders each entry as a hash link, tagged with its depth', () => {
    render(<Toc entries={ENTRIES} />);

    const intro = screen.getByRole('link', { name: 'Introduction' });
    const details = screen.getByRole('link', { name: 'Fine Details' });
    const usage = screen.getByRole('link', { name: 'Usage' });

    expect(intro.getAttribute('href')).toBe('#intro');
    expect(usage.getAttribute('href')).toBe('#usage');
    // Depth is exposed on the list item for indentation styling.
    expect(details.closest('li')?.getAttribute('data-depth')).toBe('3');
    expect(intro.closest('li')?.getAttribute('data-depth')).toBe('2');
  });

  test('renders nothing when there are no entries', () => {
    const { container } = render(<Toc entries={[]} />);
    expect(container.innerHTML).toBe('');
  });

  test('clicking an item scrolls to the heading and sets the URL hash', () => {
    mountHeadings(ENTRIES);
    render(<Toc entries={ENTRIES} />);

    const usage = screen.getByRole('link', { name: 'Usage' });
    act(() => {
      usage.click();
    });

    expect(window.location.hash).toBe('#usage');
    const heading = document.getElementById('usage') as HTMLElement;
    expect(heading.scrollIntoView).toHaveBeenCalledTimes(1);
    // Reduced-motion is unset in jsdom → smooth scroll.
    expect(heading.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    // The clicked item becomes active immediately.
    expect(usage.getAttribute('aria-current')).toBe('location');
  });

  test('active highlight tracks the section reported by the observer', () => {
    mountHeadings(ENTRIES);
    render(<Toc entries={ENTRIES} />);

    const observer = MockIntersectionObserver.instances[0];
    expect(observer).toBeDefined();
    // Every heading is observed.
    expect(observer.observed.size).toBe(ENTRIES.length);

    // Only "Usage" is in view → it is active.
    observer.fire([{ id: 'usage', isIntersecting: true }]);
    expect(
      screen.getByRole('link', { name: 'Usage' }).getAttribute('aria-current'),
    ).toBe('location');
    expect(
      screen
        .getByRole('link', { name: 'Introduction' })
        .getAttribute('aria-current'),
    ).toBeNull();

    // When several are in view, the topmost in document order wins.
    observer.fire([{ id: 'intro', isIntersecting: true }]);
    expect(
      screen
        .getByRole('link', { name: 'Introduction' })
        .getAttribute('aria-current'),
    ).toBe('location');
    expect(
      screen.getByRole('link', { name: 'Usage' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  test('seeds the active item from the URL hash on mount', () => {
    window.history.replaceState(null, '', '#details');
    mountHeadings(ENTRIES);
    render(<Toc entries={ENTRIES} />);

    expect(
      screen
        .getByRole('link', { name: 'Fine Details' })
        .getAttribute('aria-current'),
    ).toBe('location');
  });
});
