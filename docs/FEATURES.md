# Features Guide

## Public Site
- **Home & discovery**: `app/(web)/(home)/page.tsx` shows featured/latest tools with Suspense + skeletons. Search/sort/pagination handled via `server/tools/queries.ts` (`searchTools`).
- **Tool detail**: `app/(web)/tools/[slug]/page.tsx` renders rich tool pages (tags, collections, pricing, socials, gallery) using Prisma payloads from `server/tools/payloads.ts`.
- **Categories/Collections/Tags**: Listing and detail pages in `app/(web)/(home)` and `app/(web)/{categories,collections,tags}` backed by domain queries (`server/*/queries.ts`).
- **Tool submission**: `app/(web)/submit` renders `SubmitForm` which calls `submitTool` server action; duplicate site URLs short-circuit to existing tool pages. Approved submissions are placed in a moderation queue and surfaced on the `/submit/[slug]` status page while admins process them via cron.

## Admin Dashboard
- **Routing**: Lives under `app/admin`. Shared provider/layout in `app/admin/layout.tsx`.
- **Auth guard**: Admin actions wrapped with `authedProcedure` (`lib/safe-actions`) to enforce authentication.
- **Tools management**: CRUD + bulk operations in `app/admin/tools/_lib/actions.ts`; supports scheduling (`publishedAt`), asset reuploads, category/collection/tag linking.
- **Taxonomy management**: Similar CRUD for categories, collections, and tags under `app/admin/{categories,collections,tags}/_lib/actions.ts`.
- **Listings & filters**: Table queries (`app/admin/*/_lib/queries.ts`) support pagination, sorting, date filtering for review workflows.

## Data & Search
- **Data model**: `prisma/schema.prisma` defines Tool ↔ Category/Collection/Tag many-to-many relations with citext columns for case-insensitive matching.
- **Public filtering**: `server/tools/search-params.ts` normalizes query params (q, category, sort, page, perPage). All public finders enforce `publishedAt <= now` to hide unpublished tools.
- **Counts**: `_count` payloads in `server/*/payloads.ts` include published tools-only counts for badges and navigation.

## Background & Integrations
- **Event pipeline**: Inngest entry at `app/api/inngest/route.ts`; functions in `functions/*.ts` handle lifecycle events:
  - `tool.submitted`: waits for expedite/feature events, optionally emails submitter.
  - `tool.scheduled`: generates content, uploads assets (favicon/screenshot), scrapes socials, emails submitter.
  - `tool.expedited` / `tool.featured`: notifies admin + submitter.
  - `tool.published`: placeholder for future messaging.
  - `tool.deleted`: cleans S3 assets (prod only).
- **Media**: `lib/media` handles favicon/screenshot uploads to S3 via `services/aws-s3.ts`.
- **AI/content**: `lib/generate-content` (see service wrappers in `services/openai.ts`, `services/firecrawl.ts`) builds tool copy/tags during scheduling.
- **Email**: `lib/email` + `services/resend.ts` send transactional emails rendered from `emails/`.
