# Next.js 15 to 16 Migration Plan

## Overview

Migrate the project from Next.js 15.0.7 to Next.js 16.1.6 (latest).

**Current State:**
- Next.js: 15.0.7
- React: 19.0.0-rc-69d4b800-20241021
- TypeScript: 5.6.3 ✓ (meets 5.1+ requirement)

**Target State:**
- Next.js: 16.1.6
- React: 19.2 (stable)
- Node.js: 20.9+ (verify current version)

---

## Phase 1: Pre-Migration Analysis

### Files Requiring Changes

| File | Change Required |
|------|-----------------|
| `package.json` | Update `next`, `react`, `react-dom` to latest; add `@types/react` updates |
| `middleware.ts` | Rename to `proxy.ts`, rename export to `proxy` |
| `next.config.ts` | Update config for image defaults, turbopack location, remove deprecated |
| Server Actions | Update `revalidateTag()` to use `cacheLife` profile |
| Layout/Page files | Update `params` and `searchParams` to async/await |

---

## Phase 2: Package Updates

### Step 2.1: Update Dependencies

```bash
bun add next@latest react@latest react-dom@latest
bun add -D @types/react@latest @types/react-dom@latest
```

**Changes to `package.json`:**
- `next`: `15.0.7` → `16.1.6`
- `react`: `19.0.0-rc-69d4b800-20241021` → `19.2.x`
- `react-dom`: Same as react

### Step 2.2: Remove Deprecated Scripts

The project currently has:
```json
"dev": "next dev -p 5175",
"start": "next start -p 5175",
"build": "next build",
```

These should work with Next.js 16 (Turbopack is default). The `-p` flag for port is still supported.

---

## Phase 3: Middleware Migration

### Step 3.1: Rename middleware.ts to proxy.ts

Current file: `/home/thanhkt/code/stukit/middleware.ts`

Changes needed:
1. Rename file from `middleware.ts` to `proxy.ts`
2. The named export is `auth` which wraps the middleware function - this should be kept as-is
3. Update matcher to remove `_proxy/` reference (but keep for now for compatibility)

Note: The deprecation warning says `middleware.ts` is deprecated and should be renamed to `proxy.ts`. However, the function is exported via `auth()` wrapper, so we may need to also rename the function export. The codemod should handle this.

---

## Phase 4: Configuration Updates

### Step 4.1: Update next.config.ts

Current config has:
- `images.imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]` - Remove `16` (default changed)
- `images.minimumCacheTTL: 31_536_000` - Keep explicit (1 year) - good to keep
- `images.formats: ["image/avif", "image/webp"]` - Keep
- `skipTrailingSlashRedirect: true` - Keep

**New config options to add:**
```ts
turbopack: {
  // Turbopack is now default, but we can add experimental options here
}
```

### Step 4.2: Handle Image Config Breaking Changes

| Setting | Old Default | New Default | Action |
|---------|-------------|-------------|--------|
| `minimumCacheTTL` | 60s | 4 hours | Current: 1 year - KEEP |
| `imageSizes` | includes 16 | removes 16 | Current explicit - OK |
| `qualities` | 1-100 | [75] | Add if custom quality needed |
| `maximumRedirects` | unlimited | 3 | Check if needed |
| `dangerouslyAllowLocalIP` | false | false (new) | Set true if needed |

---

## Phase 5: Async Request APIs Migration

### Step 5.1: Run Codemod

```bash
npx @next/codemod@canary upgrade latest
```

This should handle:
- Async params in layouts/pages
- Async cookies(), headers(), draftMode()
- Metadata image params

### Step 5.2: Manual Fixes

After codemod, verify these patterns:

**Pages/Layouts with dynamic params:**
```tsx
// Before (Next.js 15)
export default function Page({ params, searchParams }: { params: { slug: string }, searchParams: Record<string, string> }) {
  const { slug } = params
}

// After (Next.js 16)
export default async function Page(props: { params: Promise<{ slug: string }>, searchParams: Promise<Record<string, string>> }) {
  const { slug } = await props.params
  const query = await props.searchParams
}
```

**Cookies/Headers/DraftMode:**
```tsx
// Before
const cookie = cookies()

// After
const cookie = await cookies()
```

---

## Phase 6: Server Actions Updates

### Step 6.1: Update revalidateTag() Calls

```ts
// Before
revalidateTag('blog-posts')

// After (add cacheLife profile)
revalidateTag('blog-posts', 'max')
```

Find all usages:
```bash
grep -r "revalidateTag" --include="*.ts" --include="*.tsx"
```

### Step 6.2: Consider new APIs

- `updateTag()` - For read-your-writes semantics in Server Actions
- `refresh()` - For refreshing uncached data after mutations

---

## Phase 7: Build & Test

### Step 7.1: Run Codemod First

```bash
bunx @next/codemod@canary upgrade latest
```

### Step 7.2: Install Updated Packages

```bash
bun install
```

### Step 7.3: Run Type Check

```bash
bun tsc --noEmit
```

### Step 7.4: Build

```bash
bun run build
```

### Step 7.5: Test Development Server

```bash
bun run dev
```

### Step 7.6: Test Production Build

```bash
bun run start
```

---

## Phase 8: Post-Migration Verification

### Checklist

- [ ] Verify all pages load correctly
- [ ] Check middleware/proxy is working
- [ ] Test authentication flow
- [ ] Verify image optimization works
- [ ] Test API routes
- [ ] Check Server Actions work
- [ ] Test internationalization (i18n)
- [ ] Run linting: `bun run lint`
- [ ] Test mobile responsiveness

---

## Breaking Changes Summary

| Change | Impact | Required Action |
|--------|--------|-----------------|
| Async params/searchParams | HIGH | Run codemod + verify |
| middleware → proxy | MEDIUM | Rename file |
| Turbopack default | LOW | Works automatically |
| Image config defaults | LOW | Review if custom needed |
| Node.js 20.9+ | MEDIUM | Check server version |

---

## Risk Assessment

- **Low Risk**: Image config defaults, Turbopack
- **Medium Risk**: Async API changes, middleware rename
- **High Risk**: None identified

---

## Rollback Plan

If migration fails:
1. Revert package.json to previous versions
2. Restore middleware.ts filename
3. Revert next.config.ts changes
4. Run `bun install` to reinstall old versions