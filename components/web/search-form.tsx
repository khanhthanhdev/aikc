"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type HTMLAttributes, useEffect, useState } from "react";
import { Shortcut } from "~/components/web/ui/shortcut";
import { HOME_ELEMENT_IDS } from "~/config/home";
import { useCommandPalette } from "~/contexts/command-palette-context";
import { usePathname } from "~/i18n/navigation";
import { cx } from "~/utils/cva";
import { getElementsById } from "~/utils/helpers";

export const SearchForm = ({
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement>) => {
  const t = useTranslations("Common");
  const palette = useCommandPalette();
  const isHome = usePathname() === "/";
  const isHeroInView = useIsInView(
    isHome ? HOME_ELEMENT_IDS.heroSearch : null,
    isHome
  );

  return (
    <button
      aria-hidden={isHeroInView || undefined}
      aria-label={t("search")}
      className={cx(
        "flex h-8 w-52 shrink-0 items-center gap-2 rounded-lg border bg-muted/20 px-2.5 text-muted-foreground text-sm transition-[color,background-color,opacity,visibility] duration-200 hover:bg-muted/40 hover:text-foreground max-sm:h-8 max-sm:w-8 max-sm:justify-center max-sm:border-transparent max-sm:bg-transparent max-sm:px-0",
        // The homepage's own search box is on screen; two would compete
        isHeroInView && "pointer-events-none invisible opacity-0",
        className
      )}
      onClick={palette.open}
      type="button"
      {...props}
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="whitespace-nowrap max-sm:hidden">
        {t("searchPlaceholder")}
      </span>
      <Shortcut
        className="ml-auto text-muted-foreground/80 text-xs max-sm:hidden"
        size="h6"
      >
        ⌘K
      </Shortcut>
    </button>
  );
};

/**
 * Whether the element with this id is on screen, below the sticky header.
 * `initial` is what to assume before it can be measured, so the header does
 * not flash a box that is about to hide.
 */
const useIsInView = (id: string | null, initial: boolean) => {
  const [isInView, setIsInView] = useState(initial);

  useEffect(() => {
    if (!id) {
      setIsInView(false);
      return;
    }

    // Hidden copies of other pages never intersect, so any visible copy wins
    const intersecting = new Set<Element>();
    const observed = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersecting.add(entry.target);
          } else {
            intersecting.delete(entry.target);
          }
        }
        if (intersecting.size > 0) {
          setIsInView(true);
          return;
        }
        // Only hidden copies so far: the page is still streaming in, so
        // keep the current state rather than flash the box
        const hasShownCopy = [...observed].some(
          (element) => element.getClientRects().length > 0
        );
        if (hasShownCopy) {
          setIsInView(false);
        }
      },
      { rootMargin: "-80px 0px 0px 0px" }
    );

    // The id can repeat across page trees, and after a locale switch the
    // header mounts before the page streams in, so keep picking up new copies
    const observeCopies = () => {
      for (const element of getElementsById(id)) {
        if (!observed.has(element)) {
          observed.add(element);
          observer.observe(element);
        }
      }
    };
    observeCopies();

    const mutations = new MutationObserver(observeCopies);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [id]);

  return isInView;
};
