# Inline Event Handler Attributes

Inline event-handler attributes must be stripped from any element.

<img src="./assets/sample.png" onerror="window.__pwned = true" alt="x">

<div onclick="window.__pwned = true">Click me</div>

<a href="./headings.md" onmouseover="window.__pwned = true">hover</a>

Assertion: no rendered element retains an `on*` attribute (`onerror`, `onclick`, `onmouseover`, …).
