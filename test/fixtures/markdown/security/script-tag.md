# Script Injection

Raw script tags embedded in markdown must be stripped by the sanitizer — none of the following may appear as executable `<script>` in the rendered output.

<script>window.__pwned = true;</script>

Some legitimate text in between.

<script src="https://evil.example.com/x.js"></script>

Assertion: the rendered DOM contains **no** `<script>` element and `window.__pwned` is never set.
