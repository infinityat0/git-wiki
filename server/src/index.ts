import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { contractsVersion } from '@wiki/contracts';

const app = express();
const port = Number(process.env.PORT ?? 3000);

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// This file runs from server/dist/index.js, so the built SPA lives two levels
// up in client/dist. Overridable via CLIENT_DIST for containerized layouts
// (the real config loader arrives in F3).
const clientDist =
  process.env.CLIENT_DIST ?? path.resolve(currentDir, '../../client/dist');

// --- JSON API -------------------------------------------------------------
// Hello-world only; real endpoints are added by the B* tasks.
app.get('/api/hello', (_req, res) => {
  res.json({ message: 'hello world', contractsVersion });
});

// --- Static SPA -----------------------------------------------------------
// Serve the built client, then fall back to index.html for any non-API route
// so client-side routing (deep links) works. Same origin as the API in prod
// (see ADR-0001).
app.use(express.static(clientDist));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(port, () => {
  console.log(`git-wiki server listening on http://localhost:${port}`);
});
