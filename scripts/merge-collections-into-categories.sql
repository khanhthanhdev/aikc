-- Merge the Collection taxonomy into Category.
--
-- Run this BEFORE removing the Collection model from prisma/schema.prisma,
-- because `prisma db push` drops "Collection" and "_CollectionToTool" together
-- with their rows.
--
--   docker compose exec -T postgres psql -U aikc -d aikc \
--     -f /dev/stdin < scripts/merge-collections-into-categories.sql
--
-- Each collection is matched to an existing category, in this order:
--   1. same id   (the collection was already migrated by an earlier run)
--   2. same slug (the old /collections/<slug> redirect then lands on it)
--   3. same name (case-insensitive, since name is citext)
-- A matched collection's tools are linked to that category and no new category
-- is created. Only collections with no match become a category of their own,
-- keeping their id and slug.
--
-- A name match with a different slug is listed as "needs_redirect" in the
-- report: next.config.ts only redirects /collections/<slug> to the same slug,
-- so add an explicit redirect there for each of those rows.
--
-- The script is transactional and safe to re-run.

-- Without this psql keeps going after an error and still exits 0, so a failed
-- merge would look like a success right before `db push` drops the data.
\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE collection_target ON COMMIT DROP AS
SELECT
  c.id   AS collection_id,
  c.slug AS collection_slug,
  COALESCE(
    (SELECT x.id FROM "Category" x WHERE x.id = c.id),
    (SELECT x.id FROM "Category" x WHERE x.slug = c.slug),
    (SELECT x.id FROM "Category" x WHERE x.name = c.name
      ORDER BY x."createdAt", x.id LIMIT 1)
  ) AS category_id
FROM "Collection" c;

\echo '--- collections merged into an existing category ---'
SELECT
  t.collection_slug,
  cat.slug AS category_slug,
  cat.name AS category_name,
  (cat.slug <> t.collection_slug) AS needs_redirect
FROM collection_target t
JOIN "Category" cat ON cat.id = t.category_id
WHERE t.category_id <> t.collection_id
ORDER BY needs_redirect DESC, t.collection_slug;

-- 1. Unmatched collections become categories, keeping their id so the join
--    rows below stay valid.
INSERT INTO "Category" (
  id, name, "nameVi", slug, description, "descriptionVi",
  "translationStatusVi", "translationUpdatedAtVi", "createdAt", "updatedAt"
)
SELECT
  c.id, c.name, c."nameVi", c.slug, c.description, c."descriptionVi",
  c."translationStatusVi", c."translationUpdatedAtVi", c."createdAt", c."updatedAt"
FROM "Collection" c
JOIN collection_target t ON t.collection_id = c.id
WHERE t.category_id IS NULL;

UPDATE collection_target SET category_id = collection_id WHERE category_id IS NULL;

-- 2. Tool links. In both join tables "A" is the taxonomy id and "B" the tool id.
INSERT INTO "_CategoryToTool" ("A", "B")
SELECT t.category_id, ct."B"
FROM "_CollectionToTool" ct
JOIN collection_target t ON t.collection_id = ct."A"
ON CONFLICT DO NOTHING;

\echo '--- result ---'
SELECT
  (SELECT count(*) FROM "Collection")                          AS collections,
  (SELECT count(*) FROM collection_target
    WHERE category_id <> collection_id)                        AS merged_into_existing,
  (SELECT count(*) FROM collection_target
    WHERE category_id = collection_id)                         AS became_new_category,
  (SELECT count(*) FROM "_CollectionToTool")                   AS collection_links,
  (SELECT count(*) FROM "Category")                            AS categories_after,
  (SELECT count(*) FROM "_CategoryToTool")                     AS category_links_after;

COMMIT;
