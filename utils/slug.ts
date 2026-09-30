const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LENGTH = 120;

/**
 * Whether a route param can be a tool, category or tag slug at all. Anything
 * else is answered with a 404 straight away, without a database query or a
 * cache entry for the bogus URL.
 */
export const isValidSlug = (slug: string): boolean =>
  slug.length > 0 && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
