import { range } from "@curiousleaf/utils";
import { useMemo } from "react";

export interface UsePaginationProps {
  currentPage: number;
  pageSize: number;
  siblingCount?: number;
  totalCount: number;
}

export const usePagination = ({
  currentPage,
  totalCount,
  pageSize,
  siblingCount = 1,
}: UsePaginationProps) => {
  const DOTS = "...";

  const paginationRange = useMemo(() => {
    const totalPageCount = Math.ceil(totalCount / pageSize);

    // The most items ever shown: first, last, current, its siblings and 2*DOTS
    const totalPageNumbers = 2 * siblingCount + 5;

    // If the current page is bigger than the total page numbers, we don't show anything
    if (currentPage > totalPageCount) {
      return [];
    }

    /*
      Case 1:
      If the number of pages is less than the page numbers we want to show in our
      paginationComponent, we return the range [1..totalPageCount]
    */
    if (totalPageNumbers >= totalPageCount) {
      return range(1, totalPageCount);
    }

    /*
    	Calculate left and right sibling index and make sure they are within range 1 and totalPageCount
    */
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(
      currentPage + siblingCount,
      totalPageCount
    );

    /*
      Dots only stand in for two or more pages: a single hidden page takes the
      same room as the dots, so it is shown instead. Hence leftSiblingIndex > 3
      (pages 2..leftSiblingIndex-1) and rightSiblingIndex < totalPageCount - 2
    */
    const shouldShowLeftDots = leftSiblingIndex > 3;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    /*
    	Case 2: No left dots to show, but rights dots to be shown
    */
    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = range(1, leftItemCount);

      return [...leftRange, DOTS, totalPageCount];
    }

    /*
    	Case 3: No right dots to show, but left dots to be shown
    */
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = range(
        totalPageCount - rightItemCount + 1,
        totalPageCount
      );
      return [firstPageIndex, DOTS, ...rightRange];
    }

    /*
    	Case 4: Both left and right dots to be shown
    */
    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }

    // No dots either side: every page fits
    return range(1, totalPageCount);
  }, [totalCount, pageSize, siblingCount, currentPage]);

  return paginationRange;
};
