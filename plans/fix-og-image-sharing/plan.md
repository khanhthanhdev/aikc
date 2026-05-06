# Fix OG Image Sharing for Social Platforms

## Problem Statement

The website's Open Graph (OG) images are not displaying correctly when sharing pages on Facebook, LinkedIn, and other social platforms. This affects:
- Tool detail pages (`/tools/[slug]`)
- Category pages (`/categories/[slug]`)
- Collection pages (`/collections/[slug]`)
- Tag pages (`/tags/[slug]`)
- Static pages (home, about, login, etc.)

## Current State Analysis

### Existing Implementation

1. **Dynamic OG Image Components** (`opengraph-image.tsx` files):
   - `/app/(web)/[locale]/tools/[slug]/opengraph-image.tsx` - Tool pages
   - `/app/(web)/[locale]/categories/[slug]/opengraph-image.tsx` - Category pages
   - `/app/(web)/[locale]/collections/[slug]/opengraph-image.tsx` - Collection pages
   - `/app/(web)/[locale]/tags/[slug]/opengraph-image.tsx` - Tag pages

2. **OG Base Component**:
   - `og-base.tsx` - Original component with external `getExcerpt` utility
   - `og-base-pure.tsx` - Self-contained version (used by image routes)
   - **Issue**: Two duplicate files exist, causing confusion

3. **Metadata Configuration** (`utils/metadata.ts`):
   ```typescript
   openGraph: {
     images: {
       url: `${config.media.staticHost}/opengraph.png`, // Static fallback
       width: 1200,
       height: 630,
     }
   }
   ```
   - **Issue**: Points to non-existent static image
   - **Issue**: No Twitter Card metadata configured

4. **Page-level Metadata** (e.g., `tools/[slug]/page.tsx`):
   ```typescript
   return parseMetadata({
     title,
     description,
     openGraph: { url }, // No specific images defined
   });
   ```
   - **Issue**: Doesn't reference the dynamic OG image route

### What's Broken

1. **Missing Twitter Card metadata** - Twitter uses separate `twitter:*` tags
2. **OG image URLs not absolute** - Social platforms need full URLs
3. **No explicit image reference in metadata** - Next.js should auto-generate but may not be working
4. **Duplicate OG base components** - `og-base.tsx` vs `og-base-pure.tsx`
5. **Locale-specific metadata** - Vietnamese locale not properly setting `locale` in OG tags

---

## Solution Design

### Phase 1: Code Cleanup

#### 1.1 Consolidate OG Base Components

**File**: `components/web/og/og-base.tsx`

Keep `og-base.tsx` as the primary (better organized with external utility), remove `og-base-pure.tsx`:

```typescript
// og-base.tsx stays as-is (already uses external getExcerpt)
// Delete: og-base-pure.tsx
```

Update imports in all `opengraph-image.tsx` files:
```typescript
// FROM:
import { OgBase } from "~/components/web/og/og-base-pure";
// TO:
import { OgBase } from "~/components/web/og/og-base";
```

---

### Phase 2: Add Twitter Card Support

#### 2.1 Update Metadata Utility

**File**: `utils/metadata.ts`

Add Twitter Card configuration to `parseMetadata`:

```typescript
export const parseMetadata = ({ ... }: ParseMetadataInput): Metadata => {
  const customMetadata: Metadata = {
    // ... existing config
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // Will be overridden by page-specific images if provided
    },
    // ... rest of config
  };
  return merge(customMetadata, metadata, {
    arrayMerge: (_, sourceArray) => sourceArray,
  });
};
```

---

### Phase 3: Configure Dynamic OG Images

#### 3.1 Update Tool Page Metadata

**File**: `app/(web)/[locale]/tools/[slug]/page.tsx`

The `opengraph-image.tsx` file already exists and Next.js should auto-generate the image. The issue is that the metadata needs to explicitly reference it OR trust Next.js convention.

**Option A: Trust Next.js Convention** (Recommended)
- Next.js 15 automatically generates OG images from `opengraph-image.tsx`
- The image URL will be at `/tools/[slug]/opengraph.png`
- No changes needed if convention is followed correctly

**Option B: Explicit Image Reference**
```typescript
return parseMetadata({
  title,
  description,
  openGraph: {
    url,
    images: [
      {
        url: `${config.media.staticHost}${url}/opengraph.png`,
        width: 1200,
        height: 630,
        alt: `${name} - ${tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${config.media.staticHost}${url}/opengraph.png`],
  },
});
```

**Decision**: Use Option A (trust convention) but ensure the static image exists for fallback.

---

### Phase 4: Create Fallback OG Image

#### 4.1 Generate Static OG Image

**File**: `public/opengraph.png` (needs to be created)

This is used as fallback for:
- Home page
- Pages without dynamic OG images
- Error states

**Design specs**:
- Size: 1200x630px
- Background: `#FAFAFA`
- Logo: Centered, SVG from `og-base.tsx`
- Text: "AI Knowledge Cloud" + tagline
- Use same style as dynamic OG images for consistency

---

### Phase 5: Update Media Config

#### 5.1 Add Static Host Configuration

**File**: `config/media.ts` (verify exists)

```typescript
export const mediaConfig = {
  staticHost: env.NEXT_PUBLIC_SITE_URL, // Or separate CDN URL
};
```

---

### Phase 6: Locale-Specific OG Images

#### 6.1 Vietnamese Locale Support

The existing `opengraph-image.tsx` files already handle locale-specific content. Just need to ensure:

1. **Layout metadata** (`app/(web)/[locale]/layout.tsx`):
```typescript
openGraph: {
  ...metadata.openGraph,
  locale: locale === "vi" ? "vi_VN" : "en_US",
  alternate: [
    { locale: "en_US", url: `/en${pathname}` },
    { locale: "vi_VN", url: `/vi${pathname}` },
  ],
},
```

2. **Twitter locale** (if needed for international targeting)

---

## Testing Checklist

After implementation, verify:

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
   - Tool pages show tool-specific OG image
   - Category pages show category OG image
   - Fallback image works for static pages

2. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/
   - Same as Facebook

3. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
   - `summary_large_image` card displays
   - Image loads correctly

4. **Manual Verification**:
   - Share URLs in Slack, Discord, iMessage
   - Check image dimensions (should be 1200x630)
   - Verify text is readable on generated images

---

## Implementation Order

```
1. Phase 1: Consolidate OG base components
2. Phase 2: Add Twitter Card support to metadata utility
3. Phase 3: Create static fallback OG image
4. Phase 4: Update media config with static host
5. Phase 5: Verify locale-specific metadata
6. Phase 6: Test on all platforms
```

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `components/web/og/og-base-pure.tsx` | DELETE | Remove duplicate |
| `app/**/opengraph-image.tsx` (4 files) | UPDATE | Change import to `og-base.tsx` |
| `utils/metadata.ts` | UPDATE | Add Twitter Card config |
| `public/opengraph.png` | CREATE | Static fallback image |
| `app/(web)/[locale]/layout.tsx` | UPDATE | Verify OG locale settings |
| `config/media.ts` | VERIFY | Ensure staticHost is configured |

---

## Notes

- Next.js 15 App Router handles OG images via `opengraph-image.tsx` convention
- Twitter requires explicit `twitter:*` metadata (separate from OG)
- Facebook/LinkedIn use OG tags (`og:*`)
- Always use absolute URLs for social media metadata
- Image size should be 1200x630 minimum for best quality

