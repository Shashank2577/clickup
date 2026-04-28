# syntax=docker/dockerfile:1

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

# Build arg for Clerk publishable key (required by Next.js at build time)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Workspace manifests (layer cache — changes rarely)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Root tsconfig (extended by packages)
COPY tsconfig.base.json ./

# Shared packages (contracts, sdk) — includes pre-built dist/ artifacts
COPY packages/ ./packages/

# Web app source
COPY apps/web/ ./apps/web/

# Install dependencies for web app and its workspace deps
RUN pnpm install --frozen-lockfile --filter @clickup/web...

# Build the web app.
# @clickup/contracts and @clickup/sdk have pre-built dist/ artifacts committed to the
# repo and already copied above, so we don't rebuild them here.
# (Their tsc builds require dependencies not installed by the --filter @clickup/web... scope.)
RUN pnpm --filter @clickup/web run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Copy the standalone output (self-contained Next.js server)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Note: apps/web/public does not exist in this project, so no public asset copy needed

EXPOSE 3000

# The standalone output puts the server entry at apps/web/server.js
# (monorepo path, relative to the WORKDIR /app)
CMD ["node", "apps/web/server.js"]
