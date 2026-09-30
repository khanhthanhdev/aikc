"use client";

import { getCurrentPage, getPageLink } from "@curiousleaf/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type HTMLAttributes,
  type MouseEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { PaginationLink } from "~/components/web/pagination-link";
import { type UsePaginationProps, usePagination } from "~/hooks/use-pagination";
import { usePathname } from "~/i18n/navigation";
import { cx } from "~/utils/cva";

export type PaginationProps = HTMLAttributes<HTMLElement> &
  Omit<UsePaginationProps, "currentPage">;

/**
 * Set by a click on a page link and used once the new page is on screen.
 * Kept outside the component, which may remount while the page loads.
 */
let scrollOnPageChange = false;

const PaginationInner = ({
  className,
  totalCount,
  pageSize = 1,
  siblingCount,
  ...props
}: PaginationProps) => {
  const t = useTranslations("Pagination");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams);
  const currentPage = useMemo(
    () => getCurrentPage(params.get("page")),
    [params]
  );
  const pageCount = Math.ceil(totalCount / pageSize);
  const navRef = useRef<HTMLElement>(null);

  const paginationRange = usePagination({
    currentPage,
    totalCount,
    pageSize,
    siblingCount,
  });

  // The links keep the scroll position. Once the new page has rendered, the
  // top of the list moves to just under the header, the same spot every time.
  // Scrolling on the click instead races the new list replacing the old one,
  // which cuts the smooth scroll short on some clicks and not others
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per page
  useEffect(() => {
    const list = navRef.current?.parentElement;

    if (!scrollOnPageChange || !list) {
      return;
    }
    scrollOnPageChange = false;

    // The sticky header, plus room for the fade beneath it
    const headerHeight = document.getElementById("header")?.offsetHeight ?? 0;
    const top = list.getBoundingClientRect().top - headerHeight - 24;

    // Already there, give or take a pixel
    if (Math.abs(top) > 1) {
      window.scrollBy({ top, behavior: "smooth" });
    }
  }, [currentPage]);

  if (paginationRange.length <= 1) {
    return null;
  }

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    // The current page's own link changes nothing, so it is left out
    const isLink = (event.target as Element).closest(
      'a[href]:not([aria-current="page"])'
    );

    // A modified click opens the page elsewhere, so this one stays put
    const isModified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    scrollOnPageChange = !!isLink && !isModified;
  };

  return (
    <nav
      className={cx(
        "mt-8 flex w-full items-center justify-between gap-4 md:mt-12",
        className
      )}
      {...props}
      onClick={handleClick}
      ref={navRef}
    >
      <PaginationLink
        href={getPageLink(params, pathname, currentPage - 1)}
        isDisabled={currentPage <= 1}
        prefix={<ChevronLeftIcon />}
        rel="prev"
        variant="step"
      >
        {t("prev")}
      </PaginationLink>

      <p className="text-foreground/70 text-sm md:hidden">
        {t("pageOf", { page: currentPage, total: pageCount })}
      </p>

      <div className="flex flex-wrap items-center gap-1 max-md:hidden">
        {paginationRange.map((page, index) =>
          typeof page === "number" ? (
            <PaginationLink
              aria-label={t("pageOf", { page, total: pageCount })}
              href={getPageLink(params, pathname, page)}
              isActive={currentPage === page}
              key={page}
            >
              {page}
            </PaginationLink>
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex size-10 items-center justify-center text-foreground/65 text-sm"
              // Both gaps are "...", so the position tells them apart
              key={`gap-${index}`}
            >
              {page}
            </span>
          )
        )}
      </div>

      <PaginationLink
        href={getPageLink(params, pathname, currentPage + 1)}
        isDisabled={currentPage >= pageCount}
        rel="next"
        suffix={<ChevronRightIcon />}
        variant="step"
      >
        {t("next")}
      </PaginationLink>
    </nav>
  );
};

export const Pagination = (props: PaginationProps) => (
  <Suspense>
    <PaginationInner {...props} />
  </Suspense>
);
