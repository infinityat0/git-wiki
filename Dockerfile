# syntax=docker/dockerfile:1
#
# STUB multi-stage image for git-wiki. This is intentionally minimal — task D1
# hardens it (non-root user, pruned prod deps, healthcheck, volume for
# repo-cache/, pinned digests, etc.). It exists here only to lock in the
# single-image shape from ADR-0001: one image that serves the built SPA AND the
# JSON API from the same origin.

# --- build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Copy the whole source before install: @wiki/contracts has a `prepare` script
# (tsc) that npm runs during `npm ci`, so its source must already be present.
# .dockerignore keeps the context lean (no node_modules/.git/repo-cache).
COPY . .
RUN npm ci
RUN npm run build

# --- runtime stage --------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# git is a runtime dependency: the server clones/pulls the docs repo and shells
# out to `git log`/`git pull` for history and sync.
RUN apk add --no-cache git

# Full node_modules + built workspaces (D1 will prune to production deps).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json

EXPOSE 3000
CMD ["node", "server/dist/src/index.js"]
