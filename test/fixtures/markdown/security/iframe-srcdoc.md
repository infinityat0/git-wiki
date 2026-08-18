# Iframe — srcdoc

An iframe using `srcdoc` (arbitrary inline document) must be rejected entirely — `srcdoc` is never allowed.

<iframe srcdoc="<script>window.__pwned=true</script><h1>inline</h1>" title="srcdoc attack"></iframe>

Assertion: the rendered output contains **no** iframe with a `srcdoc` attribute; the inline script never executes.
