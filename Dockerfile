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

COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage --------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Full node_modules + built workspaces (D1 will prune to production deps).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
