"use client";

import { getCurrentPage, getPageLink } from "@curiousleaf/utils";
import { MoveLeftIcon, MoveRightIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type HTMLAttributes, Suspense, useMemo } from "react";
import { PaginationLink } from "~/components/web/pagination-link";
import { navigationLinkVariants } from "~/components/web/ui/navigation-link";
import { type UsePaginationProps, usePagination } from "~/hooks/use-pagination";
import { usePathname } from "~/i18n/navigation";
import { cx } from "~/utils/cva";

export type PaginationProps = HTMLAttributes<HTMLElement> &
  Omit<UsePaginationProps, "currentPage">;

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

  const paginationRange = usePagination({
    currentPage,
    totalCount,
    pageSize,
    siblingCount,
  });

  if (paginationRange.length <= 1) {
    return null;
  }

  return (
    <nav
      className={cx(
        "-mt-px flex w-full items-start justify-between md:w-auto",
        className
      )}
      {...props}
    >
      <PaginationLink
        href={getPageLink(params, pathname, currentPage - 1)}
        isDisabled={currentPage <= 1}
        prefix={<MoveLeftIcon />}
        rel="prev"
      >
        {t("prev")}
      </PaginationLink>

      <p className="text-foreground/70 text-sm md:hidden">
        {t("pageOf", { page: currentPage, total: pageCount })}
      </p>

      <div className="flex flex-wrap items-center gap-3 max-md:hidden">
        <span className="text-foreground/70 text-sm">{t("pageLabel")}</span>

        {paginationRange.map((page) => (
          <div key={page}>
            {typeof page === "string" && (
              <span className={navigationLinkVariants()}>{page}</span>
            )}

            {typeof page === "number" && (
              <PaginationLink
                className="min-w-5 justify-center"
                href={getPageLink(params, pathname, page)}
                isActive={currentPage === page}
              >
                {page}
              </PaginationLink>
            )}
          </div>
        ))}
      </div>

      <PaginationLink
        href={getPageLink(params, pathname, currentPage + 1)}
        isDisabled={currentPage >= pageCount}
        rel="next"
        suffix={<MoveRightIcon />}
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
