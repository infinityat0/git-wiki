import { useState, useCallback, type ReactNode } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { CodeSlotProps } from '../components.js';

/**
 * Friendly display labels for common markdown code fence languages.
 */
const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  ts: 'TypeScript',
  tsx: 'TypeScript (TSX)',
  javascript: 'JavaScript',
  js: 'JavaScript',
  jsx: 'JavaScript (JSX)',
  bash: 'Shell',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  python: 'Python',
  py: 'Python',
  rust: 'Rust',
  rs: 'Rust',
  go: 'Go',
  golang: 'Go',
  sql: 'SQL',
  markdown: 'Markdown',
  md: 'Markdown',
  text: 'text',
  txt: 'text',
  plaintext: 'text',
};

/**
 * Normalizes language identifier for SyntaxHighlighter.
 */
const SYNTAX_LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  py: 'python',
  rs: 'rust',
  golang: 'go',
  yml: 'yaml',
  md: 'markdown',
  txt: 'text',
  plaintext: 'text',
};

function getLanguage(className?: string): string | undefined {
  if (!className) return undefined;
  const match = /language-([a-zA-Z0-9_-]+)/.exec(className);
  return match ? match[1] : undefined;
}

function getLanguageLabel(lang?: string): string {
  if (!lang) return 'text';
  const lower = lang.toLowerCase();
  if (LANGUAGE_LABELS[lower]) {
    return LANGUAGE_LABELS[lower];
  }
  return lang.charAt(0).toUpperCase() + lang.slice(1);
}

function normalizeSyntaxLanguage(lang?: string): string {
  if (!lang) return 'text';
  const lower = lang.toLowerCase();
  return SYNTAX_LANG_MAP[lower] ?? lower;
}

function extractText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  return '';
}

function isBlockCode(
  className?: string,
  rawCode?: string,
  node?: CodeSlotProps['node'],
): boolean {
  if (className && /language-/.test(className)) {
    return true;
  }
  if (rawCode && (rawCode.includes('\n') || rawCode.endsWith('\n'))) {
    return true;
  }
  if (
    node?.position &&
    node.position.start.column === 1 &&
    node.position.start.line !== node.position.end.line
  ) {
    return true;
  }
  return false;
}

/**
 * R1 — CodeBlock Component for the markdown pipeline's `code` slot.
 *
 * Implements Design.md §3.2:
 * - Always rendered with a dark background (`var(--code-block-bg)`).
 * - Top utility bar containing the detected language tag label and a Copy button.
 * - Interactive copy feedback ("Copied!" with revert timeout).
 * - Syntax highlighting via Prism / react-syntax-highlighter.
 * - Preserves inline code elements without framing.
 */
export function CodeBlock({
  className,
  children,
  node,
  ...rest
}: CodeSlotProps) {
  const [copied, setCopied] = useState(false);

  const rawCode = extractText(children);
  const rawLang = getLanguage(className);
  const isBlock = isBlockCode(className, rawCode, node);

  const handleCopy = useCallback(async () => {
    const textToCopy = rawCode.replace(/\n$/, '');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
    } catch {
      // Gracefully handle clipboard errors (e.g. permission or unsupported environments)
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [rawCode]);

  if (!isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  const langLabel = getLanguageLabel(rawLang);
  const langAttr = rawLang || 'text';
  const syntaxLang = normalizeSyntaxLanguage(rawLang);
  const cleanCode = rawCode.replace(/\n$/, '');

  return (
    <div
      className="code-block code-block-dark dark-frame"
      data-language={langAttr}
      style={{
        position: 'relative',
        backgroundColor: 'var(--code-block-bg, hsl(215, 21%, 11%))',
        border: '1px solid var(--border-muted, hsl(210, 16%, 93%))',
        borderRadius: '0.5rem',
        margin: '1.25rem 0',
        overflow: 'hidden',
      }}
    >
      <div
        className="code-block-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'hsl(215, 15%, 75%)',
        }}
      >
        <span
          className="code-block-lang"
          data-lang={langAttr}
          style={{
            fontWeight: 500,
            letterSpacing: '0.025em',
          }}
        >
          {langLabel}
        </span>
        <button
          type="button"
          className="code-block-copy-btn"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '0.25rem',
            color: copied
              ? 'var(--brand-green-light, #26bd6c)'
              : 'hsl(215, 15%, 75%)',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono, monospace)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div
        className="code-block-content"
        style={{
          overflowX: 'auto',
        }}
      >
        <SyntaxHighlighter
          language={syntaxLang}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            },
          }}
          PreTag="div"
        >
          {cleanCode}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export default CodeBlock;
