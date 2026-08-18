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
  --bg-secondary: hsl(210, 16%, 98%);       /* Light gray for sidebar/panels */
  --bg-tertiary: hsl(210, 16%, 93%);
  --text-primary: hsl(215, 25%, 27%);       /* Dark slate gray */
  --text-secondary: hsl(215, 16%, 47%);     /* Muted text */
  --text-accent: var(--brand-green-dark);
  
  --border-muted: hsl(210, 16%, 93%);
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
