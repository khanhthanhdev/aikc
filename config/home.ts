/**
 * Element ids on the homepage that other components look up: the header hides
 * its search box while the hero one is on screen, and a search scrolls to the
 * list of tools.
 *
 * Kept out of the client components so the server page can use them too.
 */
export const HOME_ELEMENT_IDS = {
  heroSearch: "hero-search",
  tools: "tools",
} as const;
