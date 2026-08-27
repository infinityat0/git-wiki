# Design System & Visual Guidelines

This document details the visual styling, typography, component behaviors, and layout measurements for the Git-backed Wiki. The design system is inspired by the clean, typography-focused layouts of **VitePress** and the premium, highly interactive aesthetic of **Mintlify**.

---

## 1. Design Tokens (CSS Variables)

We define our design system using CSS custom properties (`:root`) for light and dark themes.

### 1.1 Color Palette

```css
/* Color Palette Variables */
:root {
  /* Common Brand Colors */
  --brand-green-dark: hsl(146, 67%, 26%);   /* #166E3F - Primary green */
  --brand-green-light: hsl(148, 67%, 44%);  /* #26BD6C - Vibrant accent green */

  /* Light Theme (Default) */
  --theme-appearance: light;
  --bg-primary: hsl(0, 0%, 100%);
  --bg-secondary: hsl(214, 22%, 97%);       /* Cool tint for sidebar/panels */
  --bg-tertiary: hsl(214, 18%, 92%);
  --text-primary: hsl(215, 25%, 27%);       /* Dark slate gray */
  --text-secondary: hsl(215, 16%, 47%);     /* Muted text */
  --text-accent: var(--brand-green-dark);
  
  --border-muted: hsl(214, 16%, 88%);
  --border-active: var(--brand-green-light);

  --code-bg: hsl(210, 16%, 96%);
  --code-text: hsl(340, 70%, 45%);          /* Muted pink for inline code */
  --code-block-bg: hsl(215, 21%, 11%);      /* Always dark code block for high readability */
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.dark {
  /* Dark Theme */
  --theme-appearance: dark;
  --bg-primary: hsl(180, 13%, 5%);          /* #0a0d0d - Charcoal black */
  --bg-secondary: hsl(180, 8%, 8%);         /* Slightly lighter charcoal */
  --bg-tertiary: hsl(180, 8%, 14%);
  --text-primary: hsl(215, 15%, 85%);       /* Light slate */
  --text-secondary: hsl(215, 10%, 60%);     /* Muted slate */
  --text-accent: var(--brand-green-light);

  --border-muted: hsl(180, 8%, 14%);
  --border-active: var(--brand-green-light);

  --code-bg: hsl(180, 8%, 12%);
  --code-text: hsl(148, 67%, 44%);
  --code-block-bg: hsl(180, 8%, 7%);
}
```

### 1.2 Typography & Sizing

- **Font Family**:
  - UI, Headers & Body: `Inter, system-ui, -apple-system, sans-serif`
  - Monospace (Code): `JetBrains Mono, Fira Code, Courier New, monospace`
- **Base Typography Scale**:
  - `font-size: 16px` (`1rem`)
  - `line-height: 1.75` (Optimized for long-form reading)
  - `font-weight-normal: 400`
  - `font-weight-medium: 500`
  - `font-weight-semibold: 600`
  - `font-weight-bold: 700`

---

## 2. Layout & Responsive Structure

The application layout uses CSS Grid and Flexbox to divide the screen into four zones:

```
+-----------------------------------------------------------+
|                        HEADER                             |
+-------------+-------------------------------+-------------+
|             |                               |             |
|   LEFT      |           MAIN                |   RIGHT     |
|   SIDEBAR   |           CONTENT             |   TOC       |
|             |                               |             |
+-------------+-------------------------------+-------------+
```

### 2.1 Dimensions
- **Header**: Height `56px` (`3.5rem`). Fixed or sticky position at the top, frosted glass background (`backdrop-filter: blur(8px)`).
- **Left Sidebar (File Navigation Tree)**: Width `272px` (`17rem`). Sticky layout, scrollable index tree.
- **Main Content**: Max width `768px` (`48rem`). Margins set to `0 auto` to prevent line wrapping from stretching too wide.
- **Right Sidebar (Table of Contents)**: Width `240px` (`15rem`). Sticky layout on right margin.

### 2.2 Breakpoints & Responsiveness
- **Desktop (`>= 1024px`)**: Full three-column layout (Left Sidebar + Main Content + Right TOC).
- **Tablet (`768px - 1023px`)**: Collapses the Right TOC sidebar. Table of Contents can be accessed via an top toggle, or omitted.
- **Mobile (`< 768px`)**: Collapses Left Sidebar and Right TOC. The Left Sidebar converts into a sliding overlay drawer triggered by a menu button in the Header.

---

## 3. UI Components Design Specifications

### 3.1 Sidebar Navigation Tree (Left)
- **Labels are titles, not filenames**: every sidebar entry renders the document's resolved **title** (frontmatter `title` → first `H1` → prettified filename), never the raw filename or `.md` extension. See features spec §7. Long titles truncate with ellipsis and show the full title on hover (`title` attribute).
- **Grouping**: Directories must appear as groups with all-caps titles, using smaller, bold fonts (`font-size: 0.75rem`, `letter-spacing: 0.05em`) with a gray color.
- **Links**: Flat tree styling or indented lists for nested folders (`padding-left` incrementing by `0.75rem` per level).
- **States**:
  - **Hover**: Background color shifts to transparent gray / accent tint with a smooth transition (`transition: background 0.2s`).
  - **Active**: Text color switches to accent color (Green) and font weight increases (using text-shadow to avoid width shifts: `text-shadow: 0.2px 0 0 currentColor`).

### 3.2 Main Reading Area (Markdown rendering)
- **Headers (H1 - H6)**:
  - `H1`: Large title style (`font-size: 2.25rem`, `font-weight: 800`).
  - `H2`: Section headers (`font-size: 1.5rem`, `font-weight: 700`, subtle bottom border `1px solid var(--border-muted)`, `padding-bottom: 0.5rem`).
  - Anchors: Hovering over any `H2` or `H3` displays a subtle link icon (`#`) next to it to copy the direct URL hash.
- **Paragraphs**: Top/bottom margins of `1.25rem` to space out text blocks.
- **Code Blocks**:
  - Always rendered with a dark background (`var(--code-block-bg)`) to maximize color syntax contrast.
  - Features a top utility bar containing the detected language tag (e.g., `TypeScript`, `Shell`) and a "Copy" button.
  - Hovering over the block reveals the "Copy" button. Clicking it displays a quick "Copied!" checkmark.
- **Tables**:
  - Horizontal lines only (`border-bottom: 1px solid var(--border-muted)`).
  - Striped backgrounds for alternating rows (`:nth-child(even)`).
  - Hovering over rows highlights them slightly.

### 3.3 Alert & Callout Blocks
Alert blocks must render with a vertical left border (`4px`), a light matching background tint, and an inline header with a matching color and SVG icon.

| Alert Type | Left Border Color | Background Color (Light) | Background Color (Dark) | Icon Type |
| :--- | :--- | :--- | :--- | :--- |
| **NOTE** (Info) | `#0284c7` (Sky Blue) | `hsl(200, 100%, 97%)` | `hsl(200, 30%, 10%)` | Info circle / exclamation |
| **TIP** (Success) | `#166e3f` (Brand Green) | `hsl(148, 40%, 97%)` | `hsl(148, 30%, 10%)` | Checkmark circle / lightbulb |
| **WARNING** (Warning)| `#d97706` (Amber Orange) | `hsl(38, 100%, 97%)` | `hsl(38, 30%, 10%)` | Alert triangle / exclamation |
| **CAUTION** (Danger) | `#dc2626` (Red) | `hsl(0, 100%, 97%)` | `hsl(0, 30%, 10%)` | Shield alert / stop icon |

---

## 4. Theme & Interactive Motion

### 4.1 Theme Toggle
- The Sun and Moon icons transition smoothly. We use a CSS transform rotation (`transform: rotate(360deg)`) and scale animation when swapping themes.
- Transition styles:
  ```css
  .theme-toggle-icon {
    transition: transform 0.5s ease, opacity 0.3s ease;
  }
  ```

### 4.2 Search Modal
- Interactive overlay: Clicking Search or pressing `⌘K` slides open a centered modal.
- Background backdrop: Semi-transparent glass filter (`backdrop-filter: blur(4px) bg-black/40`).
- Keyboard navigability: Arrow keys navigate matching results, Enter selects, Escape dismisses.
- **Focus management**: opening traps focus inside the modal; Escape closes and returns focus to the trigger.

### 4.3 Reduced Motion
All motion (theme toggle rotation, modal/drawer slide, hover transitions) is wrapped so that under `@media (prefers-reduced-motion: reduce)` transitions collapse to near-instant and transforms are disabled:
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
Theme persists to `localStorage` and is applied by toggling the `.dark` class on `<html>` before first paint (no flash of wrong theme).

---

## 5. Authentication & Login

Login itself lives in the **SSO app** ([ADR-0005](../adrs/0005-auth-delegated-to-sso.md)); the wiki does not render provider buttons in production.
- **Production**: when read access is `AUTHENTICATED` and there's no valid session cookie, the wiki shows a brief centered "Redirecting to sign-in…" state and sends the user to `sso.prod.tapestry.app` (GitHub for engineers, Google/Firebase for everyone else are chosen *there*). On return, the shared cookie is present and the app renders normally.
- **Signed-in affordances**: a user chip (name/avatar from `/api/auth/me`) with a logout action that redirects to the SSO logout. Edit controls appear only when `canWrite` is true.
- **Dev/test (local only)**: when `AUTH_DEV_MODE` is on, a small username/password "Development sign-in" card is shown **in place of** the SSO redirect, with a muted/dashed border so it can never be mistaken for a production control. Absent entirely in production builds. Errors render inline (§10), never as raw alerts. Card uses `--bg-secondary`, `--shadow-md`, `border-radius: 0.75rem`, max-width `360px`.

## 6. Loading, Empty & Error States

Visual treatment for the state matrix in features spec §10.
- **Skeletons**: shimmering placeholder rows using a subtle gradient sweep over `--bg-tertiary` (respecting reduced-motion → static block). Used for tree rows, document title+lines, and history items.
- **Empty states**: centered muted icon + short label + optional action (e.g. "No documents yet — Sync now"). Text in `--text-secondary`.
- **Error states**: compact inline card with `--brand`-neutral warning tint, a one-line message, and a Retry button. Sync errors surface as a non-blocking toast, bottom-right.
- **Offline banner**: full-width slim bar at top of content when the network is lost; dismissible.

## 7. Embedded Content Styling

- **Iframe embeds**: wrapped in a responsive container (`aspect-ratio: 16 / 9; max-width: 100%`) with `--border-muted` 1px border and `border-radius: 0.5rem`. A disallowed-host embed renders instead as a placeholder card: link icon, the URL as a clickable link, and a muted "External embed not on allowlist" caption.
- **Mermaid diagrams**: centered SVG, `max-width: 100%`, transparent background; diagram theme variables mapped to the active light/dark palette (edges/text use `--text-secondary`, accents use `--brand-green-*`). Diagrams **re-render on theme toggle** (theme is baked into the SVG at render time). While the lazy mermaid chunk loads, show a fixed-height placeholder box (respecting reduced-motion) to avoid layout shift. On a syntax error, render an inline error card (muted warning tint, the mermaid error message in monospace) scoped to that block — the rest of the page renders normally. For accessibility, the SVG gets `role="img"` and an `aria-label`/`<title>` derived from the diagram (or a nearby heading).
- **Math (KaTeX)**: block math centered with horizontal scroll on overflow; inline math baseline-aligned with body text.

## 8. Accessibility Styling

- Global visible focus ring using `:focus-visible` (2px `--border-active` outline with 2px offset); never remove outlines without a replacement.
- Icon-only buttons (theme toggle, sync, mobile menu) carry `aria-label`s; the toggle exposes `aria-pressed`/state.
- Contrast: body and UI text meet WCAG AA against their backgrounds in both themes; the callout tints in §3.3 are paired with AA-passing text/border colors.

## 9. Print Styles

`@media print`: hide header, both sidebars, and interactive controls; render the main content full-width in a serif-friendly, high-contrast style with visible link URLs. Code blocks and tables avoid breaking mid-row where possible (`break-inside: avoid`).
