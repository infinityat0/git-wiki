# Mermaid Diagrams

A flowchart (```mermaid fence must render to inline SVG, themed to light/dark):

```mermaid
flowchart LR
    A[Browser SPA] -->|GET /api/doc| B(Express Backend)
    B -->|read| C[(repo-cache/)]
    B -->|verify JWT via JWKS| D{SSO}
```

A sequence diagram:

```mermaid
sequenceDiagram
    participant U as User
    participant W as Wiki
    participant S as SSO
    U->>W: request page
    W->>U: 302 redirect to SSO
    U->>S: authenticate
    S-->>U: set signed-JWT cookie
    U->>W: retry with cookie
    W-->>U: rendered doc
```
