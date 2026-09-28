# Kodigo: multi-stage build. Build from the repo root:
#   docker build -f docker/Dockerfile -t kodigo .
# or: docker compose -f docker/compose.yml up -d --build

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /src
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=1
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/cli/package.json packages/cli/
COPY packages/schema/package.json packages/schema/
COPY packages/sdk/package.json packages/sdk/
RUN pnpm install --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
COPY modules ./modules
COPY docs ./docs
# fail the image build if a built-in module is invalid
RUN pnpm kodigo validate modules \
 && pnpm --filter @kodigo/web build \
 && pnpm --filter @kodigo/server build

# ---- runtime ----
# The server is bundled by esbuild into a single file, so the runtime image needs no node_modules.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 DATA_DIR=/data MODULES_BUILTIN=/app/modules WEB_DIR=/app/web
COPY --from=build /src/apps/server/dist/index.js ./server/index.js
COPY --from=build /src/apps/web/dist ./web
COPY --from=build /src/modules ./modules
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["node", "server/index.js"]
