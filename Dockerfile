FROM oven/bun:1 AS base

# ------- Dependencies -------
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile

# ------- Application image (shared by build + runtime in compose) -------
# We intentionally do NOT run `next build` here. With cacheComponents enabled,
# `generateStaticParams` must reach the database at build time, which is not
# possible during `docker build` (compose services aren't reachable from the
# build sandbox). The build step is performed by the `build` compose service
# instead, after `postgres` and `migrate` are ready.
FROM base AS app
WORKDIR /app

ARG NEXT_PUBLIC_SITE_URL=http://localhost:5175
ARG NEXT_PUBLIC_SITE_EMAIL=hello@example.com

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_EMAIL=$NEXT_PUBLIC_SITE_EMAIL
ENV NODE_OPTIONS="--max-old-space-size=3072"
ENV PORT=5175
ENV HOSTNAME=0.0.0.0

# Make sure the Prisma client matches the schema we just copied.
RUN bunx prisma generate

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home nextjs && \
    mkdir -p /app/.next/cache && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 5175

CMD ["bun", "run", "start"]
