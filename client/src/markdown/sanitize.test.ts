/**
 * F7 — the sanitize allowlist is security-critical, so it is guarded: this test
 * pins the exact shape of the schema and the iframe policy. Any change to the
 * allowlist (adding a tag/attribute, widening the sandbox, editing the host
 * list) must be accompanied by an intentional change here — that is the
 * "config change requires a test to change" control (ADR-0002, task card).
 */
import { describe, expect, test } from 'vitest';
import {
  sanitizeSchema,
  IFRAME_ALLOWED_HOSTS,
  FORCED_SANDBOX,
  FORCED_LOADING,
  isAllowedIframeSrc,
  isDangerousUrl,
} from './sanitize.js';

describe('sanitize schema (the security boundary)', () => {
  test('iframe is allowed with exactly the safe attribute surface', () => {
    expect(sanitizeSchema.tagNames).toContain('iframe');
    expect(sanitizeSchema.attributes?.iframe).toEqual([
      'src',
      'title',
      'width',
      'height',
      'allow',
      'allowFullScreen',
      'loading',
      'referrerPolicy',
      'sandbox',
      'className',
    ]);
  });

  test('iframe never allows srcdoc or event handlers', () => {
    const iframeAttrs = (sanitizeSchema.attributes?.iframe ?? []) as string[];
    expect(iframeAttrs).not.toContain('srcDoc');
    expect(iframeAttrs).not.toContain('srcdoc');
    expect(iframeAttrs.some((a) => /^on/i.test(a))).toBe(false);
  });

  test('no on* handler is allowlisted on any tag', () => {
    for (const attrs of Object.values(sanitizeSchema.attributes ?? {})) {
      for (const attr of attrs) {
        const name = Array.isArray(attr) ? String(attr[0]) : String(attr);
        expect(/^on/i.test(name)).toBe(false);
      }
    }
  });

  test('script is not an allowed tag', () => {
    expect(sanitizeSchema.tagNames).not.toContain('script');
  });

  test('clobberPrefix is retained so raw ids are namespaced (slug runs after)', () => {
    expect(sanitizeSchema.clobberPrefix).toBe('user-content-');
  });
});

describe('iframe embed policy', () => {
  test('forced sandbox is the safe value and excludes dangerous tokens', () => {
    expect(FORCED_SANDBOX).toBe('allow-scripts allow-same-origin allow-popups');
    expect(FORCED_SANDBOX).not.toMatch(/allow-top-navigation/);
    expect(FORCED_SANDBOX).not.toMatch(/allow-forms/);
    expect(FORCED_LOADING).toBe('lazy');
  });

  test('host allowlist is the expected set', () => {
    expect([...IFRAME_ALLOWED_HOSTS]).toEqual([
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
      'player.vimeo.com',
      'codesandbox.io',
      'codepen.io',
    ]);
  });

  test('isAllowedIframeSrc accepts allowlisted hosts and sub-domains only', () => {
    expect(isAllowedIframeSrc('https://www.youtube-nocookie.com/embed/x')).toBe(
      true,
    );
    expect(isAllowedIframeSrc('https://codesandbox.io/embed/react-new')).toBe(
      true,
    );
    expect(isAllowedIframeSrc('https://player.vimeo.com/video/1')).toBe(true);
    // sub-domain of an allowlisted registrable host
    expect(isAllowedIframeSrc('https://foo.codesandbox.io/embed')).toBe(true);
  });

  test('isAllowedIframeSrc rejects everything else', () => {
    expect(isAllowedIframeSrc('https://evil.example.com/embed')).toBe(false);
    expect(isAllowedIframeSrc('http://192.168.0.1/admin')).toBe(false);
    // suffix-collision must not match (not a real sub-domain)
    expect(isAllowedIframeSrc('https://evil-youtube.com/embed')).toBe(false);
    expect(isAllowedIframeSrc('javascript:alert(1)')).toBe(false);
    expect(isAllowedIframeSrc('/relative/path')).toBe(false);
    expect(isAllowedIframeSrc('')).toBe(false);
    expect(isAllowedIframeSrc(undefined)).toBe(false);
  });

  test('isDangerousUrl flags script-bearing protocols', () => {
    expect(isDangerousUrl('javascript:alert(1)')).toBe(true);
    expect(isDangerousUrl('  JavaScript:alert(1)')).toBe(true);
    expect(isDangerousUrl('vbscript:msgbox(1)')).toBe(true);
    expect(isDangerousUrl('data:text/html,<script>')).toBe(true);
    expect(isDangerousUrl('https://example.com')).toBe(false);
    expect(isDangerousUrl('./relative.md')).toBe(false);
    expect(isDangerousUrl(undefined)).toBe(false);
  });
});
