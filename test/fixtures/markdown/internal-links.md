# Internal Links

A relative link to another doc must be rewritten to an SPA route (no full reload):
[the callouts fixture](./callouts.md).

A relative link with a heading anchor must preserve the fragment:
[jump to a section](./headings.md#heading-level-2).

A link up a directory:
[architecture overview](../../docs/adrs/0001-architecture-overview.md).

A link to a document that does not exist must render with a broken-link affordance rather than 404-ing the page:
[this target is missing](./does-not-exist.md).

An external link is left untouched and opens normally: [VitePress](https://vitepress.dev/).
