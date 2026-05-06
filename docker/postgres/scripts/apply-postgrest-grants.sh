#!/bin/sh
set -eu

# ---------------------------------------------------------------
# PostgREST role grants (defense-in-depth)
#
# Even though PostgREST is no longer publicly routed, this script
# hardens the web_anon role so that a future misconfiguration
# cannot leak PII columns (submitterEmail, submitterName, email,
# userEmail, etc.).
#
# Strategy:
#   1. REVOKE blanket SELECT on all existing tables.
#   2. Create views that expose only non-sensitive columns.
#   3. Grant SELECT only on those views.
# ---------------------------------------------------------------

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END
\$\$;

GRANT web_anon TO ${POSTGRES_USER};

-- Schema + sequence + function access (needed for PostgREST introspection)
GRANT USAGE ON SCHEMA public TO web_anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO web_anon;

ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO web_anon;

ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO web_anon;

-- ---------------------------------------------------------------
-- REVOKE any prior blanket grants so PII columns are never exposed
-- ---------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM web_anon;

-- ---------------------------------------------------------------
-- Public-safe views (exclude PII columns)
-- ---------------------------------------------------------------

-- Tool view: strip submitterEmail, submitterName
CREATE OR REPLACE VIEW tool_public AS
  SELECT
    id, name, "nameVi", slug, tagline, "taglineVi", description,
    "descriptionVi", content, "contentVi", summary, "summaryVi",
    "websiteUrl", "affiliateUrl", "faviconUrl", "screenshotUrl",
    pricing, "pricingVi", "pricingTier", socials, "xHandle",
    "isFeatured", "isBroken", "relatedTools",
    "publishedAt", "createdAt", "updatedAt", "lastCheckedAt",
    "translationStatusVi", "translationUpdatedAtVi"
  FROM "Tool";

-- Category view: no PII, expose all columns
CREATE OR REPLACE VIEW category_public AS SELECT * FROM "Category";

-- Tag view: no PII, expose all columns
CREATE OR REPLACE VIEW tag_public AS SELECT * FROM "Tag";

-- Collection view: no PII, expose all columns
CREATE OR REPLACE VIEW collection_public AS SELECT * FROM "Collection";

-- Ad view: strip advertiser email
CREATE OR REPLACE VIEW ad_public AS
  SELECT
    id, name, description, "websiteUrl", "buttonLabel", "faviconUrl",
    type, "startsAt", "endsAt", "stepOrder", "listInjectionIndex",
    "createdAt", "updatedAt"
  FROM "Ad";

-- Report view: no public access (contains userEmail)

-- Junction tables (Prisma uses alphabetical ordering)
CREATE OR REPLACE VIEW tool_tag_public AS SELECT * FROM "_TagToTool";
CREATE OR REPLACE VIEW tool_category_public AS SELECT * FROM "_CategoryToTool";
CREATE OR REPLACE VIEW collection_tool_public AS SELECT * FROM "_CollectionToTool";

-- ---------------------------------------------------------------
-- Grant SELECT only on the safe views
-- ---------------------------------------------------------------
GRANT SELECT ON tool_public                  TO web_anon;
GRANT SELECT ON category_public              TO web_anon;
GRANT SELECT ON tag_public                   TO web_anon;
GRANT SELECT ON collection_public            TO web_anon;
GRANT SELECT ON ad_public                    TO web_anon;
GRANT SELECT ON tool_tag_public              TO web_anon;
GRANT SELECT ON tool_category_public         TO web_anon;
GRANT SELECT ON collection_tool_public       TO web_anon;

-- Future tables: NO default grants (must be explicitly opted in)
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  REVOKE SELECT ON TABLES FROM web_anon;
SQL
