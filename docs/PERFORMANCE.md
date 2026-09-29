# Performance measurement

Optimize this deployment from measurements, not a fixed latency target. The app
benchmark records p50/p95 TTFB and total response time, response cache headers,
and CPU/RAM snapshots for every running Docker service.

## Application baseline

Run the production app or local development server, then benchmark it directly:

```sh
BENCH_TOOL_SLUG=published-tool-slug bun run benchmark:app
```

The defaults are `http://localhost:5175`, 20 requests per route, and the query
`productivity`. Override them when measuring the deployed path through Caddy and
Cloudflare:

```sh
BENCH_BASE_URL=https://aikc.vn \
BENCH_ROUNDS=50 \
BENCH_TIMEOUT_MS=15000 \
BENCH_QUERY=writing \
BENCH_TOOL_SLUG=published-tool-slug \
BENCH_IMAGE_URL='https://aikc.vn/_next/image?url=...&w=1080&q=75' \
bun run benchmark:app
```

Save the complete output with the date, commit, dataset size, host size, and
whether the run was direct or through Cloudflare. Compare the first request with
p50/p95 and inspect `cache-control`, `age`, `x-nextjs-cache`, and
`cf-cache-status`. Run the same benchmark after a catalog edit to observe stale
serving and regeneration. Do not add a blanket HTML cache rule: dynamic and
user-specific responses must retain Next.js's cache policy.

Use `BENCH_IMAGE_URL` with a representative screenshot request before changing
image formats or offloading resizing. Compare origin CPU, response time,
`content-type`, and Cloudflare cache status. AVIF should remain enabled only when
the bandwidth gain is worth its cold encode cost.

## PostgreSQL keyword search

Profile both the paginated result and count query against representative data:

```sh
bun run profile:keyword-search -- productivity 14
```

The command reports table size, existing indexes, execution time, and
`EXPLAIN (ANALYZE, BUFFERS)` output. Capture plans for common and uncommon terms.
The current development database may be empty; plans from an empty table do not
justify an index.

Only add `pg_trgm` GIN indexes when representative plans show keyword search is
a material bottleneck. Prefer the smallest set of columns responsible for the
measured scans. Re-run both plans after each candidate index and account for its
disk and write cost. The extension is already declared in the Prisma datasource.

## Deferred changes

Do not add jemalloc, PgBouncer, a custom shared cache handler, or another runtime
until the baseline identifies a matching bottleneck. This checkout already uses
the Next.js standalone output and persists `.next/cache` for its single app
instance.
