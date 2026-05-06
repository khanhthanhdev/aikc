# System Architecture & Module Guide

**Purpose:** Transfer documentation for new teams joining the project.

**Last Updated:** 2026-04-01

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Architecture](#2-module-architecture)
3. [Tool Submission Workflow](#3-tool-submission-workflow)
4. [Tool Processing Pipeline](#4-tool-processing-pipeline)
5. [Publishing Flow](#5-publishing-flow)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Extending the System](#8-extending-the-system)

---

## 1. System Overview

### 1.1 What This System Does

This is an **AI-powered tool directory platform** that:
- Accepts tool submissions from users
- Automatically processes submissions using AI (content generation, screenshots, translations)
- Provides semantic search via vector database (Qdrant)
- Publishes tools with admin approval
- Sends notifications at each stage

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Bun | Package manager & JavaScript runtime |
| **Framework** | Next.js 15 + React 19 | Web application framework |
| **Database** | PostgreSQL + Prisma ORM | Primary data storage |
| **Vector DB** | Qdrant | Semantic search & caching |
| **Embeddings** | Infinity (local) / OpenAI | Text vectorization |
| **AI Models** | Alibaba Qwen | Content generation, translation |
| **Background Jobs** | Inngest | Async job processing |
| **Scraping** | Firecrawl | Web content extraction |
| **Storage** | AWS S3 | Asset storage (screenshots, favicons) |

### 1.3 Key Architectural Patterns

- **Server Actions** (zsa): All mutations use type-safe server actions with Zod validation
- **Event-Driven Pipeline**: Inngest handles async workflows (submission → processing → publishing)
- **Hybrid Search**: Combines dense vectors (semantic) + sparse vectors (keyword/BM25)
- **Multi-tenant Ready**: Supports Vietnamese translations alongside English content

---

## 2. Module Architecture

### 2.1 Directory Structure

```
stukit/
├── app/                      # Next.js App Router
│   ├── (web)/                # Public-facing pages
│   │   ├── [locale]/         # i18n routes
│   │   │   ├── tools/[slug]/ # Tool detail pages
│   │   │   ├── categories/   # Category listings
│   │   │   ├── collections/  # Collection listings
│   │   │   └── submit/       # Submission form
│   └── admin/                # Admin dashboard
│       ├── tools/            # Tool management
│       ├── categories/       # Category management
│       └── collections/      # Collection management
│
├── server/                   # Business Logic Layer
│   ├── tools/                # Tool operations
│   ├── categories/           # Category operations
│   ├── collections/          # Collection operations
│   ├── tags/                 # Tag operations
│   └── schemas.ts            # Shared Zod schemas
│
├── functions/                # Inngest Job Handlers
│   ├── tool-submitted.ts     # Initial submission processing
│   ├── tool-scheduled.ts     # Scheduled publication processing
│   ├── tool-published.ts     # Post-publish notifications
│   ├── tool-featured.ts      # Featured tool handling
│   ├── tool-expedited.ts     # Expedited processing
│   ├── tool-deleted.ts       # Cleanup on deletion
│   └── link-checker.ts       # Periodic link validation
│
├── services/                 # External Service Clients
│   ├── prisma.ts             # Database client
│   ├── qdrant.ts             # Vector DB client
│   ├── inngest.ts            # Job queue client
│   ├── alibaba.ts            # AI model client
│   ├── firecrawl.ts          # Web scraper client
│   ├── aws-s3.ts             # Storage client
│   └── embedding.ts          # Embedding generation
│
├── lib/                      # Core Utilities
│   ├── vector-store.ts       # Vector operations (upsert, search)
│   ├── generate-content.ts   # AI content generation
│   ├── translate-content.ts  # Translation utilities
│   ├── media.ts              # Screenshot/favicon upload
│   ├── socials.ts            # Social media extraction
│   └── related-tools.ts      # Related tools computation
│
├── actions/                  # Server Actions (public)
│   ├── submit.ts             # Public tool submission
│   └── search.ts             # Search operations
│
└── prisma/
    └── schema.prisma         # Database schema
```

### 2.2 Module Responsibilities

#### `app/` - Presentation Layer
- Renders UI components
- Handles routing and internationalization
- Triggers server actions on user input

#### `server/` - Business Logic Layer
- Encapsulates domain logic
- Provides reusable operations (CRUD, queries)
- Uses Prisma for database access

#### `functions/` - Background Job Handlers
- Long-running async operations
- Event-driven execution via Inngest
- Handles: content generation, asset uploads, vector sync, notifications

#### `services/` - Infrastructure Layer
- Wraps external APIs (Qdrant, Alibaba, Firecrawl, S3)
- Manages connections and clients
- Provides consistent interfaces

#### `lib/` - Shared Utilities
- Reusable functions across layers
- Vector operations, AI generation, media handling
- No direct HTTP request handling

#### `actions/` - Server Actions
- Entry points for form submissions
- Input validation with Zod
- Trigger Inngest events for async processing

---

## 3. Tool Submission Workflow

### 3.1 User Submission Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER SUBMISSION FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

1. User visits /submit
         │
         ▼
2. Fills form (form.tsx)
   - Name, Email, Tool URL
         │
         ▼
3. Submits form → submitTool action (actions/submit.ts)
         │
         ▼
4. Server Action validates:
   - URL is reachable (link-validator.ts)
   - Tool doesn't exist (database check)
   - Input passes Zod schema
         │
         ▼
5. Creates Tool record in PostgreSQL
   - Status: draft (no publishedAt)
   - Slug auto-generated
         │
         ▼
6. Returns to user with success message
   - "Queued for review" or "Already exists"
```

### 3.2 Code Path

| Step | File | Function |
|------|------|----------|
| Form UI | `app/(web)/[locale]/submit/form.tsx` | `SubmitForm` component |
| Action Handler | `actions/submit.ts` | `submitTool` |
| Link Validation | `lib/link-validator.ts` | `validateLink()` |
| Database Create | `services/prisma.ts` | `prisma.tool.create()` |

### 3.3 Schema Definition

```typescript
// server/schemas.ts
export const submitToolSchema = z.object({
  name: z.string().min(1).max(100),
  websiteUrl: z.string().url().max(500),
  submitterName: z.string().min(1).max(100),
  submitterEmail: z.string().email().max(255),
});
```

---

## 4. Tool Processing Pipeline

### 4.1 Overview

Admin triggers processing from admin dashboard. The pipeline:
1. Scrapes website content
2. Generates AI content (description, tagline, tags)
3. Uploads screenshots and favicon
4. Translates to Vietnamese
5. Syncs to vector database

### 4.2 Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TOOL SUBMITTED WORKFLOW                             │
│                         (functions/tool-submitted.ts)                    │
└─────────────────────────────────────────────────────────────────────────┘

Trigger: tool.submitted event
  │
  ├─► STEP: fetch-tool
  │    └─► Get tool from database
  │
  ├─► PARALLEL STEPS:
  │    │
  │    ├─► generate-content
  │    │    ├─► Scrape URL (Firecrawl)
  │    │    ├─► Generate with AI (Alibaba Qwen)
  │    │    │    - tagline (60 chars)
  │    │    │    - description (160 chars)
  │    │    │    - content (1000 chars)
  │    │    │    - pricing
  │    │    │    - tags (max 10)
  │    │    └─► Save to database
  │    │
  │    ├─► upload-screenshot
  │    │    ├─► Capture via ScreenshotOne
  │    │    ├─► Upload to S3
  │    │    └─► Save URL to database
  │    │
  │    └─► upload-favicon
  │         ├─► Fetch from website
  │         ├─► Upload to S3
  │         └─► Save URL to database
  │
  ├─► STEP: translate-to-vietnamese
  │    ├─► Check if already translated
  │    ├─► If not: translate content fields
  │    └─► Save with status: MACHINE
  │
  ├─► STEP: sync-tool-vector
  │    ├─► Build document from tool data
  │    ├─► Generate dense embedding (768 dims)
  │    ├─► Generate sparse embedding (BM25)
  │    └─► Upsert to Qdrant (tools_hybrid)
  │
  ├─► STEP: sync-alternative-vector
  │    └─► Index for "related tools" recommendations
  │
  ├─► STEP: update-related-tools
  │    └─► Compute and persist related tool slugs
  │
  └─► WAIT: 30 minutes for expedited/featured events
       │
       └─► If received: process differently
       └─► If not: send standard submission email (disabled)
```

### 4.3 Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `generateContent()` | `lib/generate-content.ts` | AI content generation |
| `uploadScreenshot()` | `lib/media.ts` | Screenshot capture & upload |
| `uploadFavicon()` | `lib/media.ts` | Favicon extraction & upload |
| `translateToVietnamese()` | `lib/translate-content.ts` | Translation via AI |
| `upsertHybridToolVector()` | `lib/vector-store.ts` | Vector DB sync |
| `updateToolRelatedTools()` | `lib/related-tools.ts` | Related tools computation |

### 4.4 Vector Store Operations

The system uses **hybrid search** combining:

1. **Dense Vectors** (Semantic Search)
   - 768 dimensions (or 384 for local Infinity)
   - Captures meaning and context
   - Generated via embedding models

2. **Sparse Vectors** (Keyword Search)
   - BM25-style term frequency
   - 30,000 vocabulary size
   - Handles exact keyword matching

```typescript
// lib/vector-store.ts
export const upsertHybridToolVector = async (tool) => {
  const document = buildToolDocument(tool); // Combine all text fields

  // Generate both vectors
  const sparseVector = generateSparseEmbedding(document);
  const denseVector = await generateEmbedding(document, {
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  // Upsert to Qdrant with named vectors
  await qdrantClient.upsert(QDRANT_HYBRID_COLLECTION, {
    points: [{
      id: toUUID(tool.id),
      vector: {
        dense: denseVector,
        sparse: { indices: sparseVector.indices, values: sparseVector.values },
      },
      payload: serializeToolPayload(tool),
    }],
  });
};
```

---

## 5. Publishing Flow

### 5.1 Admin Publish Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ADMIN PUBLISH FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

1. Admin views pending tools in /admin/tools
         │
         ▼
2. Reviews tool (content, screenshots, assets)
         │
         ▼
3. Clicks "Publish" or "Schedule"
         │
         ▼
4. Server Action: scheduleTools() or updateTool()
   │
   ├─► Sets publishedAt date
   ├─► Syncs vectors to Qdrant
   └─► Sends tool.scheduled or tool.published event
         │
         ▼
5. Inngest triggers tool-scheduled.ts
   ├─► Re-processes content (fresh scrape)
   ├─► Updates social handles
   └─► Syncs vectors again
         │
         ▼
6. If publishedAt <= now: tool is live
   └─► Visible on public site
```

### 5.2 Scheduled vs Immediate Publish

| Type | Event Triggered | Behavior |
|------|-----------------|----------|
| **Immediate** | `tool.published` | Published now, visible immediately |
| **Scheduled** | `tool.scheduled` | Processed now, published at `publishedAt` |

### 5.3 Event Types

```typescript
// services/inngest.ts
interface Events {
  "tool.submitted": { data: { id: string; slug: string } };
  "tool.scheduled": { data: { id: string; slug: string } };
  "tool.published": { data: { id: string; slug: string } };
  "tool.featured": { data: { id: string; slug: string } };
  "tool.expedited": { data: { id: string; slug: string } };
  "tool.deleted": { data: { id: string; slug: string } };
}
```

---

## 6. Data Flow Diagrams

### 6.1 Database Schema (Prisma)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                  │
└─────────────────────────────────────────────────────────────────────────┘

Tool
├── id: String @id @default(cuid())
├── name: String @unique
├── nameVi: String?              # Vietnamese translation
├── slug: String @unique
├── tagline: String?
├── taglineVi: String?
├── description: String?
├── descriptionVi: String?
├── content: String?             # AI-generated long description
├── contentVi: String?
├── websiteUrl: String @unique
├── faviconUrl: String?          # S3 URL
├── screenshotUrl: String?       # S3 URL
├── pricing: String?
├── pricingVi: String?
├── pricingTier: PricingTier?    # FREE, FREEMIUM, PAID, OPEN_SOURCE
├── socials: Json?               # { name, url }[]
├── isFeatured: Boolean @default(false)
├── translationStatusVi: TranslationStatus @default(MISSING)
├── publishedAt: DateTime?
├── relatedTools: String[]       # Array of tool slugs
├── categories: Category[]       # Many-to-many
├── collections: Collection[]    # Many-to-many
└── tags: Tag[]                  # Many-to-many

Category, Collection, Tag
├── id: String @id
├── name: String @unique
├── nameVi: String?
├── slug: String @unique
└── tools: Tool[]
```

### 6.2 Component Communication

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT COMMUNICATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│ Server Action│────▶│  Inngest     │
│  (app/)      │     │ (actions/)   │     │  (functions/)│
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                      │
       │                    ▼                      │
       │             ┌──────────────┐              │
       │             │  Business    │              │
       │             │   Logic      │              │
       │             │  (server/)   │              │
       │             └──────────────┘              │
       │                    │                      │
       │                    ▼                      │
       │             ┌──────────────┐              │
       └────────────▶│  Services    │◀─────────────┘
                     │ (database,   │
                     │  vector DB,  │
                     │  AI, S3)     │
                     └──────────────┘
```

---

## 7. API Reference

### 7.1 Server Actions

| Action | File | Input | Output |
|--------|------|-------|--------|
| `submitTool` | `actions/submit.ts` | `{ name, websiteUrl, submitterName, submitterEmail }` | `Tool` |
| `createTool` | `app/admin/tools/_lib/actions.ts` | `ToolSchema` | `Tool` |
| `updateTool` | `app/admin/tools/_lib/actions.ts` | `{ id, ...ToolSchema }` | `Tool` |
| `scheduleTools` | `app/admin/tools/_lib/actions.ts` | `{ ids, publishedAt }` | `true` |
| `processTools` | `app/admin/tools/_lib/actions.ts` | `{ ids }` | `true` |
| `deleteTools` | `app/admin/tools/_lib/actions.ts` | `{ ids }` | `true` |
| `translateToolToVietnamese` | `app/admin/tools/_lib/actions.ts` | `{ id }` | `Tool` |

### 7.2 Inngest Events

| Event | Handler | Triggered By |
|-------|---------|--------------|
| `tool.submitted` | `functions/tool-submitted.ts` | User submission or admin process |
| `tool.scheduled` | `functions/tool-scheduled.ts` | Admin schedules publish |
| `tool.published` | `functions/tool-published.ts` | Tool goes live |
| `tool.featured` | `functions/tool-featured.ts` | Admin features tool |
| `tool.expedited` | `functions/tool-expedited.ts` | Admin expedites processing |
| `tool.deleted` | `functions/tool-deleted.ts` | Tool deletion |

### 7.3 Vector Operations

| Function | File | Purpose |
|----------|------|---------|
| `upsertHybridToolVector()` | `lib/vector-store.ts` | Add/update tool in vector DB |
| `deleteHybridToolVector()` | `lib/vector-store.ts` | Remove from vector DB |
| `hybridSearchToolVectors()` | `lib/vector-store.ts` | Search with dense + sparse |
| `searchToolsByName()` | `lib/vector-store.ts` | Find tools by name |
| `reindexAllHybridTools()` | `lib/vector-store.ts` | Rebuild index |

---

## 8. Extending the System

### 8.1 Adding a New Inngest Event

```typescript
// 1. Define event in services/inngest.ts
interface Events {
  "tool.reviewed": { data: { id: string; slug: string; status: string } };
}

// 2. Create handler in functions/tool-reviewed.ts
export const toolReviewed = inngest.createFunction(
  { id: "tool.reviewed" },
  { event: "tool.reviewed" },
  async ({ event, step }) => {
    // Implementation
  }
);

// 3. Register in functions/inngest.ts
export const { handler } = inngest.createHandler({
  functions: [
    toolSubmitted,
    toolScheduled,
    toolReviewed, // Add here
  ],
});
```

### 8.2 Adding a New Vector Collection

```typescript
// 1. Define collection config in services/qdrant.ts
export const QDRANT_NEW_COLLECTION = "new_items";

export const ensureNewCollection = async () => {
  // Collection creation logic
};

// 2. Add upsert/search functions in lib/vector-store.ts
export const upsertNewVector = async (item) => {
  await ensureNewCollection();
  // Upsert logic
};

export const searchNewVectors = async (query) => {
  // Search logic
};
```

### 8.3 Adding a New AI Provider

```typescript
// 1. Create service in services/new-ai.ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const newAIModel = createOpenAICompatible({
  baseURL: process.env.NEW_AI_BASE_URL,
  apiKey: process.env.NEW_AI_API_KEY,
});

// 2. Update lib/generate-content.ts
import { newAIModel } from "~/services/new-ai";

const model = newAIModel("model-name");
```

---

## Appendix A: Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...

# Vector DB
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=...

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ALIBABA_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Local Embedding (Infinity)
USE_LOCAL_EMBEDDING=true
INFINITY_EMBEDDING_URL=http://localhost:7997/v1
INFINITY_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Services
FIRECRAWL_API_KEY=...
RESEND_API_KEY=...
SCREENSHOTONE_ACCESS_KEY=...
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY=...
S3_SECRET_ACCESS_KEY=...

# Auth
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Site
NEXT_PUBLIC_SITE_URL=https://aikc.vn
NEXT_PUBLIC_SITE_EMAIL=hello@aikc.vn
```

---

## Appendix B: Common Operations

### Reindex All Tools

```bash
bun run scripts/setup-qdrant.ts --reindex
```

### Clear Semantic Cache

```bash
bun run scripts/clear-semantic-cache.ts
```

### Test Embeddings

```bash
bun run scripts/test-infinity-embedding.ts
bun run scripts/test-local-qdrant-embedding.ts
```

### Check Vector Drift

```bash
bun run scripts/check-qdrant-drift.ts
```

---

**End of Document**
