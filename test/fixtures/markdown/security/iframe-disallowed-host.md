# Iframe — Disallowed Host

An iframe whose `src` host is not in `IFRAME_ALLOWED_HOSTS` must NOT render as a live frame; it must be replaced by the placeholder card showing the URL.

<iframe src="https://evil.example.com/embed" title="Malicious"></iframe>

<iframe src="http://192.168.0.1/admin" title="Internal SSRF-ish target"></iframe>

Assertion: the rendered output contains **no** live `<iframe>` pointing at `evil.example.com` or a raw IP; a placeholder card is rendered instead.
