FROM oven/bun:1 AS base

# ------- Dependencies -------
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile

# ------- Builder -------
FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_SITE_URL=http://localhost:5175
ARG NEXT_PUBLIC_SITE_EMAIL=hello@example.com
ARG SKIP_ENV_VALIDATION=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (non-secret, needed for Next.js static optimization)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_EMAIL=$NEXT_PUBLIC_SITE_EMAIL
ENV SKIP_ENV_VALIDATION=$SKIP_ENV_VALIDATION

# Increase Node memory for build process
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    AUTH_SECRET=build-placeholder-secret \
    AUTH_GOOGLE_ID=build-placeholder-google-id \
    AUTH_GOOGLE_SECRET=build-placeholder-google-secret \
    SCREENSHOTONE_ACCESS_KEY=build-placeholder-screenshotone-access-key \
    OPENAI_API_KEY=build-placeholder-openai-api-key \
    ANTHROPIC_API_KEY=build-placeholder-anthropic-api-key \
    GEMINI_API_KEY=build-placeholder-gemini-api-key \
    FIRECRAWL_API_KEY=build-placeholder-firecrawl-api-key \
    RESEND_API_KEY=build-placeholder-resend-api-key \
    S3_BUCKET=build-placeholder-bucket \
    S3_REGION=us-east-1 \
    S3_ACCESS_KEY=build-placeholder-s3-access-key \
    S3_SECRET_ACCESS_KEY=build-placeholder-s3-secret-access-key \
    QDRANT_URL=http://localhost:6333 \
    QDRANT_API_KEY=build-placeholder-qdrant-api-key \
    bun run build

# ------- Runner -------
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5175
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

RUN mkdir -p /app/.next/cache && \
    chown -R nextjs:nodejs /app/.next

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone server + static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema for runtime (migrations, etc.)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy source files needed for Server Components (i18n, dynamic routes)
COPY --chown=nextjs:nodejs i18n ./i18n
COPY --chown=nextjs:nodejs messages ./messages

USER nextjs

EXPOSE 5175

CMD ["bun", "run", "server.js"]
