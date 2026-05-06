# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
bun install              # Install dependencies
bun run dev              # Start development server at localhost:5175
bun run build            # Build for production
bun run start            # Start production server at localhost:5175
```

### Database (Prisma + PostgreSQL)
```bash
bun run db:generate      # Generate Prisma client
bun run db:studio        # Open Prisma Studio
bun run db:push          # Push schema to database (no migration files)
bun run db:reset         # Reset database and push schema
```

### Vector Database (Qdrant)
```bash
bun run qdrant:setup     # Initialize Qdrant collections
bun run qdrant:reset     # Force recreate collections
bun run qdrant:test      # Test search functionality
bun run qdrant:drift     # Check for schema drift
bun run qdrant:clear-cache # Clear semantic cache
```

### Code Quality
```bash
bun run lint             # Run Biome linter and apply fixes
bun run format           # Format code with Biome
bun run check            # Run Biome check and apply fixes
bun run icons            # Generate SVG sprite from assets/icons
```

### Data Import Scripts
```bash
bun run import:ai-tools           # Import AI study tools data
bun run related-tools:populate    # Populate related tools relationships
```

## Architecture

### Tech Stack
- **Runtime**: Bun (package manager & runtime)
- **Framework**: Next.js 15 App Router with React 19 RC
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Vector DB**: Qdrant for semantic search and caching
- **Styling**: Tailwind CSS with dual configs (`tailwind.web.config.ts`, `tailwind.admin.config.ts`)
- **UI**: Shadcn UI + Radix UI components
- **Server Actions**: zsa (type-safe server actions with Zod validation)
- **State**: nuqs for URL query state management
- **AI**: Vercel AI SDK with multiple providers (OpenAI, Anthropic, Google Gemini, Groq)
- **Background Jobs**: Inngest for tool lifecycle events
- **Storage**: AWS S3 for images/screenshots
- **Email**: Resend for transactional emails

### Directory Structure

#### App Routes (`app/`)
- `app/(web)/` - Public-facing marketing and tool directory pages
- `app/admin/` - Admin dashboard for managing tools, categories, collections
- `app/api/` - API route handlers:
  - `api/auth/` - NextAuth.js authentication
  - `api/chat/` - AI chat API with semantic caching
  - `api/inngest/` - Inngest webhook endpoint
  - `api/rag/` - RAG (Retrieval-Augmented Generation) endpoints

#### Server Logic (`server/`)
Domain-specific server actions and data loaders organized by entity:
- `server/tools/` - Tool CRUD operations
- `server/categories/` - Category management
- `server/collections/` - Collection management
- `server/tags/` - Tag management
- `server/web/` - Public web data fetching
- `server/schemas.ts` - Shared Zod schemas

#### Background Jobs (`functions/`)
Inngest job handlers for tool lifecycle automation:
- `tool-submitted.ts` - Process new tool submissions (Firecrawl scraping, screenshot generation)
- `tool-scheduled.ts` - Handle scheduled tool publishing
- `tool-published.ts` - Send publication notifications
- `tool-featured.ts` - Feature tool notifications
- `tool-expedited.ts` - Expedite tool processing
- `tool-deleted.ts` - Cleanup on deletion
- `link-checker.ts` - Periodic link validation

#### Services (`services/`)
Third-party service integrations and clients:
- `prisma.ts` - Prisma client singleton with Accelerate caching
- `qdrant.ts` - Qdrant client, collection management, hybrid search setup
- `google.ts` - Google Gemini embedding and chat models
- `openai.ts` - OpenAI client
- `groq.ts` - Groq client
- `aws-s3.ts` - S3 upload utilities
- `resend.ts` - Email client
- `firecrawl.ts` - Web scraping client
- `inngest.ts` - Inngest client and event definitions
- `ai-chat-tools.ts` - AI chat tool integrations (YouTube search, etc.)

#### Components (`components/`)
Reusable UI components built with Shadcn/Radix

#### Utilities
- `utils/` - General utilities (formatting, validation, helpers)
- `lib/` - Core libraries (fetchers, schemas, semantic cache logic)
- `types/` - Shared TypeScript types
- `config/` - Application configuration

#### Data & Assets
- `prisma/schema.prisma` - Database schema (Tool, Category, Collection, Tag, Ad, Report models)
- `data/` - Static data files
- `assets/` - Static assets
- `public/` - Public static files

### Key Architectural Patterns

#### Database Schema
- Uses PostgreSQL extensions: `citext` (case-insensitive text), `pg_trgm` (trigram search)
- Main models: Tool, Category, Collection, Tag (many-to-many relations)
- Tools have `relatedTools` (string array of slugs)
- Prisma Accelerate for connection pooling and caching

#### Vector Search with Qdrant
- **Hybrid Collections**: Combine dense vectors (embeddings) + sparse vectors (BM25 keyword matching)
- Collections:
  - `tools_hybrid` - Main tool search with text + metadata
  - `alternatives_hybrid` - Alternative tool suggestions
  - `categories_hybrid` - Category-based search
  - `semantic_cache` - Caches AI responses for similar queries
- Embedding model: `text-embedding-v4` (768 dimensions)
- Semantic cache threshold: 0.92 similarity score

#### Server Actions (zsa)
All mutations use type-safe server actions:
```typescript
export const someAction = createServerAction()
  .input(z.object({ slug: z.string() }))
  .handler(async ({ input }) => {
    // Action logic
    return { success: true, data: result }
  })
```

#### AI Chat with Semantic Caching
- `app/api/chat/route.ts` - Streaming AI responses
- Semantic cache checks question similarity before LLM invocation
- Tool-specific context injection for relevant tools
- YouTube video search integration

#### Background Job Pipeline
1. Tool submitted → Firecrawl scrapes metadata
2. Generate screenshot via ScreenshotOne
3. Upload assets to S3
4. Update database
5. Schedule publishing or publish immediately
6. Send notifications on publish/feature

#### Styling Architecture
- Two Tailwind configs for different sections (web vs admin)
- Mobile-first responsive design
- Server components by default, client components wrapped in Suspense

### Code Style (from .cursorrules)

- **TypeScript**: Prefer types over interfaces, avoid enums (use maps)
- **Functions**: Arrow functions for pure functions
- **File structure**: Exported component, subcomponents, helpers, static content, types
- **Naming**: Lowercase with dashes for directories (e.g., `auth-wizard`)
- **Server Actions**: Always use zsa with Zod input validation
- **URL State**: Use `nuqs` (useQueryState) for all query string state
- **Optimization**: Minimize 'use client', favor RSC, wrap client components in Suspense
- **Images**: WebP format, lazy loading, include size data

### Environment Setup

Required environment variables (see `.env.example`):
- Database: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (Neon)
- Auth: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- AI APIs: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
- Vector DB: `QDRANT_URL`, `QDRANT_API_KEY`
- Storage: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_ACCESS_KEY`
- Services: `FIRECRAWL_API_KEY`, `RESEND_API_KEY`, `SCREENSHOTONE_ACCESS_KEY`
- Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_EMAIL`
- Feature flags: `RAG_ENABLED`, `PUBLISH_SUBMITTER_EMAILS`

### Initial Setup

1. Clone repository
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env` and configure
4. Push database schema: `bun run db:push`
5. Initialize Qdrant collections: `bun run qdrant:setup`
6. Start development server: `bun run dev`

### Deployment

- Platform: Vercel
- Build command: `bun run build`
- Start command: `bun run start`
- Ensure all environment variables are set in production
- Database connection uses pooling via Prisma Accelerate
