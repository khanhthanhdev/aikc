#API & Data Contracts

## Conventions
- **Server actions**: Implemented with `zsa`/`zsa-react` or `authedProcedure`. Inputs validated via Zod schemas in `app/admin/*/_lib/validations.ts` and `server/schemas.ts`. Errors throw typed exceptions surfaced to UI toasts.
- **Database**: Prisma client singleton from `services/prisma.ts`; public-facing queries always filter `publishedAt <= now` unless explicitly bypassed with auth.
- **Events**: Inngest is the integration point for async work; HTTP entry at `app/api/inngest/route.ts` exposes `GET/POST/PUT`.

## Public Server Actions
- `submitTool` (`actions/submit.ts`)
  ```ts
  // Input schema: submitToolSchema (server/schemas.ts)
  {
    name: string
    websiteUrl: string // URL
    submitterName: string
    submitterEmail: string
  }
  // Behavior: dedupe by websiteUrl, generate unique slug, create tool,
  // emit Inngest event "tool.submitted". Returns created or existing tool row.
  ```

## Admin Server Actions (auth required via authedProcedure)
- **Tools** (`app/admin/tools/_lib/actions.ts`)
  - `createTool` / `updateTool` / `updateTools` / `deleteTools`
  - `scheduleTools` (bulk set `publishedAt` and emit `tool.scheduled`)
  - `reuploadToolAssets` (refresh favicon/screenshot via `lib/media`)
  - Input schema: `toolSchema` (`app/admin/tools/_lib/validations.ts`) plus IDs/slug params.
- **Categories** (`app/admin/categories/_lib/actions.ts`)
  - `createCategory`, `updateCategory`, `updateCategories`, `deleteCategories`
  - Schema: `categorySchema`.
- **Collections** (`app/admin/collections/_lib/actions.ts`)
  - `createCollection`, `updateCollection`, `updateCollections`, `deleteCollections`
  - Schema: `collectionSchema`.
- **Tags** (`app/admin/tags/_lib/actions.ts`)
  - `createTag`, `updateTag`, `updateTags`, `deleteTags`
  - Schema: `tagSchema`.
- All admin actions revalidate relevant `/admin/*` paths to refresh caches.

## Query Helpers (server-only)
- **Public site**: `server/tools/queries.ts` exposes `searchTools`, `findTools`, `findToolSlugs`, `findUniqueTool`, `findFirstTool`, `countTools`, `countUpcomingTools`. Default filters: published items only; includes `toolManyPayload` or `toolOnePayload` relations.
- **Taxonomies**: `server/{categories,collections,tags}/queries.ts` provide list + slug lookups with published tool gating. Payload files include `_count` of published tools.
- **Admin tables**: `app/admin/*/_lib/queries.ts` give paginated lists with sorting/date filters and basic select payloads.

## Events & Background Jobs (Inngest)
- HTTP endpoint: `app/api/inngest/route.ts` registers:
  - `tool.submitted` → `functions/tool-submitted.ts` (dedupe, wait for expedite/feature, email submitter unless expedited/featured)
  - `tool.scheduled` → `functions/tool-scheduled.ts` (AI content generation, S3 favicon/screenshot uploads, social scraping, submitter email)
  - `tool.published` → `functions/tool-published.ts` (currently TODO)
  - `tool.expedited` → `functions/tool-expedited.ts` (admin + submitter emails)
  - `tool.featured` → `functions/tool-featured.ts` (admin + submitter emails)
  - `tool.deleted` → `functions/tool-deleted.ts` (prunes S3 directory in prod)
- Emitters: `actions/submit.ts` (submitted), `app/admin/tools/_lib/actions.ts` (scheduled/deleted), and `functions/tool-submitted.ts` (waits for expedite/feature events).

## Data Shapes (Prisma)
- Tool fields: see `prisma/schema.prisma` (`name`, `slug`, `tagline`, `description`, `content`, `websiteUrl`, `affiliateUrl`, `faviconUrl`, `screenshotUrl`, `pricing`, `socials: Json`, `isFeatured`, `xHandle`, `submitterName`, `submitterEmail`, `publishedAt`, timestamps) with many-to-many relations to Category/Collection/Tag.
- Payload helpers:
  - `server/tools/payloads.ts`: `toolOnePayload` includes categories/collections/tags; `toolManyPayload` includes collections.
  - `server/{categories,collections,tags}/payloads.ts`: `_count` of published tools for badges.

## Prisma Schema for EN/VI Content

### Field Mapping (English + Vietnamese)
- EN: The schema stores English as base fields and Vietnamese in parallel `*Vi` fields.
- VI: Schema lưu tiếng Anh ở field gốc và tiếng Việt ở field song song `*Vi`.
- EN: Translation workflow is tracked with `translationStatusVi` and `translationUpdatedAtVi`.
- VI: Luồng dịch được theo dõi bằng `translationStatusVi` và `translationUpdatedAtVi`.

### Schema Excerpt (from `prisma/schema.prisma`)
```prisma
enum TranslationStatus {
  MISSING
  MACHINE
  REVIEWED
}

model Tool {
  name                    String
  nameVi                  String?
  tagline                 String?
  taglineVi               String?
  description             String?
  descriptionVi           String?
  summary                 String?
  summaryVi               String?
  content                 String?
  contentVi               String?
  pricing                 String?
  pricingVi               String?
  translationStatusVi     TranslationStatus @default(MISSING)
  translationUpdatedAtVi  DateTime?
}

model Category {
  name                    String
  nameVi                  String?
  label                   String?
  labelVi                 String?
  description             String?
  descriptionVi           String?
  translationStatusVi     TranslationStatus @default(MISSING)
  translationUpdatedAtVi  DateTime?
}

model Collection {
  name                    String
  nameVi                  String?
  description             String?
  descriptionVi           String?
  translationStatusVi     TranslationStatus @default(MISSING)
  translationUpdatedAtVi  DateTime?
}

model Tag {
  name                    String
  nameVi                  String?
  translationStatusVi     TranslationStatus @default(MISSING)
  translationUpdatedAtVi  DateTime?
}
```

## Prisma Query Reference (English + Vietnamese)

### Scope / Phạm vi
- EN: This section documents Prisma query patterns currently used in this project, including public queries, admin queries, and bilingual (English/Vietnamese) search logic.
- VI: Phần này mô tả các pattern Prisma query đang dùng trong dự án, gồm query public, query admin, và logic tìm kiếm song ngữ (English/Vietnamese).

### 1) Prisma Client Setup / Khởi tạo Prisma Client
- EN: Prisma is initialized as a singleton in `services/prisma.ts` to avoid multiple client instances during hot reload.
- VI: Prisma được khởi tạo theo singleton trong `services/prisma.ts` để tránh tạo nhiều client khi hot reload.
- EN: Logging policy: development logs `error` + `warn`; production logs only `error`.
- VI: Chính sách log: môi trường development log `error` + `warn`; production chỉ log `error`.

### 2) Type-safe Include Payloads / Payload Include an toàn kiểu dữ liệu
- EN: The project uses `Prisma.validator<...>()` for reusable include payloads (`toolOnePayload`, `toolManyPayload`, `categoryManyPayload`, etc.).
- VI: Dự án dùng `Prisma.validator<...>()` để tạo payload include tái sử dụng (`toolOnePayload`, `toolManyPayload`, `categoryManyPayload`, ...).
- EN: Benefit: shared include shape + consistent TS inference across query functions.
- VI: Lợi ích: dùng chung cấu trúc include + suy luận kiểu TypeScript nhất quán giữa các hàm query.

```ts
const tools = await prisma.tool.findMany({
  where: { publishedAt: { lte: new Date() } },
  include: toolManyPayload(),
});
```

### 3) Public Visibility Filter / Bộ lọc hiển thị public
- EN: Public finders consistently gate by publish time: `publishedAt <= now`.
- VI: Các hàm finder public luôn chặn theo thời gian publish: `publishedAt <= now`.
- EN: Example functions: `findTools`, `findToolSlugs`, `countTools`, `findFirstTool`, `searchTools`.
- VI: Ví dụ hàm: `findTools`, `findToolSlugs`, `countTools`, `findFirstTool`, `searchTools`.
- EN: Upcoming tools are counted with `OR: [publishedAt > now, publishedAt = null]`.
- VI: Tool sắp publish được đếm bằng `OR: [publishedAt > now, publishedAt = null]`.

### 4) Locale-aware Query (EN/VI) / Query theo ngôn ngữ (EN/VI)
- EN: For `locale = "vi"`, keyword where clauses search Vietnamese fields first (`nameVi`, `taglineVi`, `descriptionVi`, `contentVi`) and then fallback to English fields.
- VI: Với `locale = "vi"`, điều kiện keyword ưu tiên field tiếng Việt (`nameVi`, `taglineVi`, `descriptionVi`, `contentVi`) và fallback sang field tiếng Anh.
- EN: For `locale = "en"`, queries search English fields only.
- VI: Với `locale = "en"`, query chỉ tìm trên field tiếng Anh.
- EN: Taxonomy queries (`Category`, `Collection`, `Tag`) also support bilingual matching (`nameVi` + `name`, and `slug` for tags).
- VI: Query taxonomy (`Category`, `Collection`, `Tag`) cũng hỗ trợ match song ngữ (`nameVi` + `name`, và `slug` cho tags).

```ts
const keywordWhere =
  locale === "vi"
    ? {
        OR: [
          { nameVi: { contains: q, mode: "insensitive" } },
          { descriptionVi: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }
    : {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      };
```

### 5) Sorting and Pagination / Sắp xếp và phân trang
- EN: Query modules parse sort strings like `"createdAt.desc"` into dynamic `orderBy`.
- VI: Các module query parse chuỗi sort như `"createdAt.desc"` thành `orderBy` động.
- EN: Pagination uses `skip` and `take` (`offset = (page - 1) * per_page`).
- VI: Phân trang dùng `skip` và `take` (`offset = (page - 1) * per_page`).
- EN: For Vietnamese locale sorting by name, code sometimes fetches full list and sorts in app layer (`sortByLocalizedName`) before slicing.
- VI: Với locale tiếng Việt khi sort theo tên, code đôi lúc lấy toàn bộ danh sách rồi sort ở app layer (`sortByLocalizedName`) trước khi cắt trang.

### 6) Filter Composition / Ghép điều kiện filter
- EN: Complex filters are composed with `Prisma.ToolWhereInput[]` and merged via `AND`.
- VI: Filter phức tạp được ghép bằng `Prisma.ToolWhereInput[]` rồi merge bằng `AND`.
- EN: Typical combined filters: category slug + keyword + pricing + published gate.
- VI: Bộ filter thường gặp: category slug + keyword + pricing + điều kiện publish.
- EN: Pricing filter logic supports inferred tiers (`free`, `freemium`, `paid`) from both enum fields and text fields.
- VI: Logic lọc pricing hỗ trợ suy luận tier (`free`, `freemium`, `paid`) từ cả enum và text field.

### 7) Transactions for List + Count / Transaction cho danh sách + tổng số
- EN: Admin listing queries use `prisma.$transaction([findMany, count])` to keep page data and total count consistent.
- VI: Query danh sách admin dùng `prisma.$transaction([findMany, count])` để đảm bảo dữ liệu trang và tổng số nhất quán.
- EN: Used in tools/categories/collections/tags/ads admin query modules.
- VI: Được dùng ở module query admin tools/categories/collections/tags/ads.

```ts
const [items, total] = await prisma.$transaction([
  prisma.tool.findMany({ where, orderBy, take: perPage, skip: offset }),
  prisma.tool.count({ where }),
]);
```

### 8) CRUD and Relation Writes / CRUD và ghi dữ liệu quan hệ
- EN: Create/update in admin actions use relation operators:
  - `connect` for initial relation links
  - `set` for replacing relation links
  - `connectOrCreate` for tag auto-create in content pipeline
- VI: Create/update ở admin actions dùng relation operators:
  - `connect` để gắn quan hệ ban đầu
  - `set` để thay toàn bộ quan hệ
  - `connectOrCreate` để tự tạo tag trong pipeline nội dung
- EN: Batch operations use `updateMany` and `deleteMany`.
- VI: Batch operation dùng `updateMany` và `deleteMany`.
- EN: `findUniqueOrThrow` is used when a record must exist (pipeline/scheduled flows).
- VI: `findUniqueOrThrow` được dùng khi bản ghi bắt buộc phải tồn tại (pipeline/scheduled flows).

### 9) Aggregation / Tổng hợp dữ liệu
- EN: The admin tools query uses `groupBy` on `publishedAt` for status counts.
- VI: Query admin tools dùng `groupBy` theo `publishedAt` để thống kê trạng thái.

```ts
await prisma.tool.groupBy({
  by: ["publishedAt"],
  _count: { publishedAt: true },
});
```

### 10) Active Date-window Queries / Query theo khoảng thời gian hiệu lực
- EN: Ads queries define active records by `startsAt <= now` and `endsAt >= now`.
- VI: Query quảng cáo xác định bản ghi còn hiệu lực bằng `startsAt <= now` và `endsAt >= now`.
- EN: Type filtering combines exact type and global fallback type `All`.
- VI: Lọc theo type kết hợp type cụ thể và type fallback toàn cục `All`.

### 11) Hybrid Search Hydration Pattern / Pattern hydrate hybrid search
- EN: Semantic search gets ranked IDs from vector DB, then hydrates full entities with Prisma (`id in [...]`) and applies relational includes.
- VI: Semantic search lấy danh sách ID đã xếp hạng từ vector DB, sau đó hydrate entity đầy đủ bằng Prisma (`id in [...]`) và áp dụng include quan hệ.
- EN: If semantic path fails, system falls back to Prisma keyword query.
- VI: Nếu semantic lỗi, hệ thống fallback về keyword query bằng Prisma.

### 12) Query Safety and Operational Notes / Lưu ý an toàn và vận hành
- EN: User inputs are sanitized before DB writes in `actions/submit.ts`.
- VI: Input người dùng được sanitize trước khi ghi DB trong `actions/submit.ts`.
- EN: Public reads enforce published gating; admin reads bypass that when needed.
- VI: Query đọc public luôn có điều kiện publish; query admin bỏ điều kiện đó khi cần.
- EN: Date filtering in admin pages normalizes ranges with `startOfDay` and `endOfDay`.
- VI: Lọc ngày trong trang admin chuẩn hóa bằng `startOfDay` và `endOfDay`.

### 13) Prisma Query File Map / Bản đồ file Prisma Query
- EN: Main files to inspect when changing Prisma logic.
- VI: Các file chính cần xem khi chỉnh sửa logic Prisma.
- `services/prisma.ts`
- `prisma/schema.prisma`
- `server/tools/queries.ts`
- `server/tools/payloads.ts`
- `server/categories/queries.ts`
- `server/collections/queries.ts`
- `server/tags/queries.ts`
- `server/web/ads/queries.ts`
- `app/admin/tools/_lib/queries.ts`
- `app/admin/categories/_lib/queries.ts`
- `app/admin/collections/_lib/queries.ts`
- `app/admin/tags/_lib/queries.ts`
- `app/admin/ads/_lib/queries.ts`
- `app/admin/tools/_lib/actions.ts`
- `actions/submit.ts`
- `actions/search.ts`
