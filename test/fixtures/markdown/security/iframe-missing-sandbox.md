# Iframe — Missing Sandbox

An allowlisted-host iframe authored WITHOUT a sandbox attribute must still be rendered WITH the forced sandbox value — authors cannot opt out.

<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="No sandbox authored"></iframe>

An attempt to widen the sandbox must be overridden to the safe value, not trusted:

<iframe src="https://codesandbox.io/embed/react-new" sandbox="allow-scripts allow-same-origin allow-top-navigation allow-forms" title="Over-permissive"></iframe>

Assertion: every rendered iframe carries the forced sandbox value (no `allow-top-navigation`; no author-supplied widening survives).
