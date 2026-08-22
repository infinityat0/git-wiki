import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from '../config/index.js';
import { healthRouter } from '../routes/health.js';
import { treeRouter } from '../routes/tree.js';
import { docRouter } from '../routes/doc.js';
import { assetRouter } from '../routes/asset.js';
import { historyRouter } from '../routes/history.js';
import { searchRouter } from '../routes/search.js';
import { rebuildSearchIndex } from '../search/index.js';
import { syncRouter } from '../routes/sync.js';
import { startSyncPoller } from '../sync/poller.js';
import { authMiddleware } from '../auth/index.js';
import { authRouter } from '../routes/auth.js';
import { bootstrapRepoCache } from '../boot/repo-cache.js';
import { createGitCredentialProvider } from '../lib/git-credential.js';

const app = express();

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Built output runs from server/dist/src/index.js, so the built SPA lives three
// levels up in client/dist. Overridable via CLIENT_DIST for containerized layouts.
const clientDist =
  process.env.CLIENT_DIST ?? path.resolve(currentDir, '../../../client/dist');

// --- JSON API -------------------------------------------------------------
// Routers register their own absolute `/api/*` paths (mounted before the SPA
// fallback). More endpoints are added by the remaining B* tasks.
app.use(healthRouter);

// Populate req.user from the SSO cookie for all routes below (non-blocking;
// per-route read/write authorization guards are applied where needed). The
// health probe above stays public. NOTE: read-gating (requireRead) is not yet
// applied to the doc/tree/etc. routes — enable it when SSO is wired for deploy.
app.use(authMiddleware);
app.use(authRouter);

app.use(treeRouter);
app.use(docRouter);
app.use(assetRouter);
app.use(historyRouter);
app.use(searchRouter);
app.use(syncRouter);

// --- Static SPA -----------------------------------------------------------
// Serve the built client, then fall back to index.html for any non-API route
// so client-side routing (deep links) works. Same origin as the API in prod.
app.use(express.static(clientDist));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// --- Startup --------------------------------------------------------------
// Clone/pull the docs repo (failures are swallowed by bootstrap: the server
// stays up but "not ready" so the k8s readiness probe holds traffic), then
// begin listening.
async function main(): Promise<void> {
  await bootstrapRepoCache({
    repoUrl: config.docs.repoUrl,
    branch: config.docs.repoBranch,
    cacheDir: config.docs.repoCacheDir,
    credential: createGitCredentialProvider(config.git),
  });

  // Build the search index once the docs clone is present (flips readiness → ready).
  rebuildSearchIndex();

  // Poll the docs remote for updates (config.docs.syncPollInterval; 0 disables).
  startSyncPoller();

  app.listen(config.port, () => {
    console.log(`git-wiki server listening on http://localhost:${config.port}`);
  });
}

void main();
