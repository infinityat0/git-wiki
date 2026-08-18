# Embedded iframes (allowlisted)

A YouTube (nocookie) embed from an allowlisted host — must render as a live, sandboxed, lazy-loaded iframe wrapped in a responsive 16:9 container:

<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Demo video" width="560" height="315" allow="encrypted-media"></iframe>

A CodeSandbox embed (also allowlisted):

<iframe src="https://codesandbox.io/embed/react-new" title="Live example"></iframe>

Notes for assertions:
- The rendered iframes must carry a forced `sandbox` attribute (e.g. `allow-scripts allow-same-origin allow-popups`).
- The rendered iframes must carry `loading="lazy"`.
- Disallowed-host and `srcdoc` cases live in `security/` — they must NOT render as live frames.
