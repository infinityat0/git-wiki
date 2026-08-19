# Mermaid — Injection Attempts

Mermaid renders client-side **after** `rehype-sanitize`, so these must be neutralized by mermaid's own `securityLevel: 'strict'` config, not the rehype allowlist. None may execute script, bind a click/navigation, or inject raw HTML.

## HTML label injection

```mermaid
flowchart LR
    A["<img src=x onerror='window.__pwned=true'>"] --> B["<b>bold</b>"]
```

## click / callback interaction directive

```mermaid
flowchart TD
    A[Click me] --> B[Target]
    click A "javascript:window.__pwned=true" "tooltip"
    click B call pwn() "cb"
```

## %%{init}%% security downgrade attempt

```mermaid
%%{init: {"securityLevel": "loose", "flowchart": {"htmlLabels": true}}}%%
flowchart LR
    X["<script>window.__pwned=true</script>"] --> Y
```

Assertions: rendered SVG contains **no** `<script>`, **no** `on*` attributes, **no** `<foreignObject>` carrying HTML, and **no** `href`/click handler beginning with `javascript:`; `window.__pwned` is never set; the author-supplied `securityLevel: loose` is ignored.
