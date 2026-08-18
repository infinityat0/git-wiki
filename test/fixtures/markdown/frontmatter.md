---
title: Human-Friendly Title
order: 5
hidden: false
---

# A Different H1 Than The Title

This document has YAML frontmatter. Assertions:

- The frontmatter block above must **not** be rendered into the document body.
- The sidebar/document label must use the frontmatter `title` ("Human-Friendly Title"), not the filename (`frontmatter.md`) and not this H1.
- `order: 5` influences sidebar sort position within its folder.
