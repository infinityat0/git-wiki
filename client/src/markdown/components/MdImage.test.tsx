// @vitest-environment jsdom
/**
 * R6 — `MdImage` L1 (DOM structure) + L2 (golden snapshot).
 *
 * Renders the shared `images` fixture through F7's pipeline with the `img` slot
 * under test and asserts the §8 contract: relative `src` rewritten to the
 * `/api/asset` endpoint, absolute URLs passed through, `alt` rendered as a
 * caption in a display-block `<span>` wrapper (valid inside the `<p>`
 * react-markdown wraps a standalone image in).
 */
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderFixture,
  renderMarkdown,
} from '../../../../test/unit/render/harness.js';
import { MdImage } from './MdImage.js';

afterEach(cleanup);

const slots = { img: MdImage };

/** Parse a raw href/src (which may be relative) into a URL for inspection. */
function parse(raw: string): URL {
  return new URL(raw, 'http://localhost');
}

describe('MdImage — L1 DOM structure', () => {
  test('a relative src resolves through /api/asset?path=…', () => {
    const { container } = renderFixture('images', { slots });
    const img = container.querySelector('.md-image');
    const raw = img?.getAttribute('src') ?? '';
    const url = parse(raw);
    expect(url.pathname).toBe('/api/asset');
    expect(url.searchParams.get('path')).toBe('assets/architecture.png');
  });

  test('an absolute URL is passed through untouched', () => {
    const { container } = renderFixture('images', { slots });
    const imgs = container.querySelectorAll('.md-image');
    const remote = Array.from(imgs).find((i) =>
      (i.getAttribute('src') ?? '').startsWith('https://'),
    );
    expect(remote?.getAttribute('src')).toBe(
      'https://vitepress.dev/vitepress-logo-mini.svg',
    );
  });

  test('the image is wrapped in a caption block and alt becomes the caption', () => {
    const { container } = renderFixture('images', { slots });
    const figure = container.querySelector('.md-figure');
    // A span wrapper (not <figure>): valid phrasing content inside the <p>
    // react-markdown wraps a standalone image in.
    expect(figure?.tagName).toBe('SPAN');
    expect(
      figure?.closest('p'),
      'wrapper must stay inside its paragraph',
    ).not.toBeNull();
    expect(figure?.querySelector('.md-image')).not.toBeNull();
    const caption = figure?.querySelector('.md-figure-caption');
    expect(caption?.textContent).toBe('Architecture diagram of the wiki');
  });

  test('the image is constrained and rounded (presentation)', () => {
    const { container } = renderFixture('images', { slots });
    const img = container.querySelector<HTMLImageElement>('.md-image');
    expect(img?.style.maxWidth).toBe('100%');
    expect(img?.style.borderRadius).toBe('8px');
  });

  test('relative src resolves against the injected basePath', () => {
    const { container } = renderMarkdown('![alt](./diagram.png)', {
      slots: { img: (props) => <MdImage {...props} basePath="guide/intro" /> },
    });
    const raw = container.querySelector('.md-image')?.getAttribute('src') ?? '';
    expect(parse(raw).searchParams.get('path')).toBe('guide/intro/diagram.png');
  });
});

describe('MdImage — L2 golden snapshot', () => {
  test('rendered HTML is stable', () => {
    const { container } = renderFixture('images', { slots });
    expect(container.innerHTML).toMatchSnapshot();
  });
});
