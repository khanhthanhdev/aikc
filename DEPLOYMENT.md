# Deployment Guide

## Summary of Fixes

All fixes address Qdrant hybrid search, Infinity embedding, and Docker Compose deployment issues.

### 1. Qdrant Hybrid Search Collections

**Problem:** Collections were created with flat vector config, but app uses named vectors (`dense` + `sparse`) for RRF fusion hybrid search.

**Fix:** Use REST API directly (JS client doesn't support `sparse_vectors` config):

```typescript
// services/qdrant.ts & scripts/setup-qdrant.ts
await fetch(`${QDRANT_URL}/collections/${name}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    vectors: { dense: { size: 384, distance: "Cosine" } },
    sparse_vectors: { sparse: { modifier: "idf" } },
  }),
});
```

**Files:** `services/qdrant.ts`, `scripts/setup-qdrant.ts`

---

### 2. Infinity Embedding Dimension Mismatch

**Problem:** ENV vars are strings, embedding length is number → strict equality fails.

**Fix:** Convert to number at source:

```typescript
// services/infinity.ts
export const INFINITY_EMBEDDING_DIMENSIONS = Number(env.INFINITY_EMBEDDING_DIMENSIONS);

const outputDimensionality = Number(
  options.outputDimensionality ?? INFINITY_EMBEDDING_DIMENSIONS
);
```

**Files:** `services/infinity.ts`, `services/qdrant.ts`

---

### 3. Network Error Handling

**Problem:** Raw `fetch()` without error handling for network failures.

**Fix:**

```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ status: { error: response.statusText } }));
    throw new Error(`Failed: ${error.status?.error || response.statusText}`);
  }
} catch (error) {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    throw new Error(`Qdrant unavailable at ${url}`);
  }
  throw error;
}
```

**Files:** `services/qdrant.ts`, `scripts/setup-qdrant.ts`

---

### 4. Dynamic Rendering for Server Components

**Problem:** `DYNAMIC_SERVER_USAGE` errors from `Math.random()` and `new Date()` in server components.

**Fix:** Add `export const dynamic = "force-dynamic"`:

**Files:** 
- `app/(web)/[locale]/tools/[slug]/page.tsx`
- `app/(web)/[locale]/tools/[slug]/related-tools.tsx`
- `app/(web)/[locale]/categories/[slug]/page.tsx`
- `app/(web)/[locale]/collections/[slug]/page.tsx`
- `app/(web)/[locale]/tags/[slug]/page.tsx`
- `app/(web)/[locale]/submit/[slug]/page.tsx`

---

### 5. S3 Image Optimization

**Problem:** Next.js Image optimization fails for S3-hosted favicons.

**Fix:** Add `unoptimized` prop:

```tsx
// components/web/ui/favicon.tsx
<Image
  src={src}
  unoptimized={src.includes("amazonaws.com")}
  {...props}
/>
```

**Files:** `components/web/ui/favicon.tsx`

---

## Step-by-Step Deployment to Server

### Prerequisites

1. Server has Docker & Docker Compose installed
2. Git repository accessible
3. `.env` file configured for production

---

### Step 1: Commit and Push Changes

```bash
cd /home/thanhkt/code/stukit

# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "fix: Qdrant hybrid search, Infinity embedding, and Docker deployment

- Use REST API for Qdrant collection creation (sparse_vectors support)
- Fix Infinity embedding dimension type mismatch
- Add network error handling for Qdrant API calls
- Add dynamic exports for server components using Math.random()/Date()
- Add unoptimized prop for S3 images in favicon component
- Fix next.config.ts S3 remote patterns

Breaking: Qdrant collections recreated with named vectors (dense/sparse)"

# Push to remote
git push origin main
```

---

### Step 2: SSH into Server

```bash
ssh root@103.130.219.88
# Password: eqM21q+!r_X8Tv+2
```

---

### Step 3: Pull Latest Changes

```bash
cd /path/to/stukit
git pull origin main
```

---

### Step 4: Verify Environment Variables

Check `.env` file has correct values. The Gemini model names are passed to the
application container at runtime, so changing either one requires recreating
the `app` container.

```bash
grep -E "QDRANT|INFINITY|EMBEDDING|GEMINI|GOOGLE_FLASH" .env
```

Required variables:
```env
QDRANT_URL="http://qdrant:6333"
QDRANT_API_KEY="your-qdrant-api-key"
INFINITY_EMBEDDING_URL="http://infinity:7997"
INFINITY_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
INFINITY_EMBEDDING_DIMENSIONS="384"
USE_LOCAL_EMBEDDING="true"
GEMINI_API_KEY="your-gemini-api-key"
# Main chat, RAG, and translation model
GOOGLE_FLASH_MODEL="gemini-2.5-flash"
# Lightweight routing and content-generation model
GOOGLE_FLASH_LITE_MODEL="gemini-2.5-flash-lite"
```

---

### Step 5: Rebuild and Restart Services

```bash
# Rebuild all containers with latest code
docker compose down

# Remove old images to force rebuild
docker compose rm -f

# Rebuild and start
docker compose up -d --build
```

---

### Step 6: Recreate Qdrant Collections (if needed)

If collections have wrong schema, recreate them:

```bash
# Option A: Run setup script inside app container
docker compose exec app bun run scripts/setup-qdrant.ts --force

# Option B: Use Docker Compose profile
docker compose --profile setup up qdrant-setup
```

This will:
1. Delete existing `tools_hybrid`, `alternatives_hybrid`, `categories_hybrid`
2. Recreate with correct named vectors + sparse vectors
3. Reindex all 104 tools, alternatives, and 11 categories

---

### Step 7: Verify Deployment

```bash
# Check container status
docker compose ps

# Check app logs
docker compose logs app --tail 50

# Check for errors
docker compose logs app --since 5m | grep -E "error|Error|ERROR"

# Verify Qdrant collections
docker compose logs qdrant --tail 20 | grep "collections"

# Test endpoint (from inside container)
docker compose exec app wget -qO- http://localhost:5175 | head -5
```

Expected output:
- All containers `Running`
- App logs show `✓ Ready in XXms`
- No `Bad Request` errors from Qdrant
- Hybrid search returns 200 OK

---

### Step 8: Test in Browser

1. Navigate to `https://aikc.vn/tools/wolfram-alpha`
2. Verify:
   - Page loads without `DYNAMIC_SERVER_USAGE` error
   - Related tools section shows 3 tools
   - Favicon images load (no 400 Bad Request)
   - Search works with hybrid results

---

### Step 9: Monitor for Issues

```bash
# Watch real-time logs
docker compose logs -f app

# Check Qdrant query success rate
docker compose logs qdrant | grep "POST /collections.*query" | tail -20

# Check Infinity embedding requests
docker compose logs infinity | tail -10
```

---

## Rollback Procedure

If deployment fails:

```bash
# 1. Revert to previous commit
git revert HEAD

# 2. Rebuild containers
docker compose up -d --build

# 3. Or restore from backup if available
docker compose down
# Restore volumes from backup
docker compose up -d
```

---

## Post-Deployment Checklist

- [ ] All containers running (`docker compose ps`)
- [ ] No errors in app logs
- [ ] Qdrant collections have correct points count
- [ ] Hybrid search returns results (not 400 errors)
- [ ] S3 images load correctly
- [ ] Tool pages render without dynamic errors
- [ ] Semantic cache working (check logs for "cache hit")

---

## Troubleshooting

### Qdrant 400 Bad Request
```bash
# Check collection config
curl http://localhost:6333/collections/tools_hybrid | jq .

# Should show: vectors.dense.size = 384, sparse_vectors.sparse.modifier = "idf"
# If flat config, recreate with --force
```

### Infinity 404 Not Found
```bash
# Test endpoint directly
curl -X POST http://localhost:7997/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": ["test"], "model": "sentence-transformers/all-MiniLM-L6-v2"}'

# Should return embedding array
```

### S3 Images 400
```bash
# Check next.config.ts remotePatterns
# Verify S3 bucket URL matches pattern
# Clear Next.js cache
docker compose restart app
```

### Build Fails
```bash
# Check Node/Bun version
docker compose run app bun --version

# Clear node_modules and reinstall
docker compose down
rm -rf node_modules .next
bun install
docker compose up -d --build
```
