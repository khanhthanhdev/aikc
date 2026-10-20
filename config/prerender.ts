/**
 * How many tool, tag and submit pages `next build` renders ahead of time, per
 * locale. The rest render on their first visit and are cached like the others.
 * Rendering all of them (about 14,000 pages with both locales) runs the 2 GB
 * VPS out of memory mid-build, which takes the site down.
 */
export const PRERENDER_LIMIT = 100;
