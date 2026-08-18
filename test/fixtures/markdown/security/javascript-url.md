# javascript: URLs

`javascript:` URLs in links and images must be removed or neutralized.

[click me](javascript:window.__pwned=true)

<a href="javascript:alert(1)">raw anchor</a>

![x](javascript:alert(1))

Assertion: no rendered `href` or `src` begins with `javascript:`.
