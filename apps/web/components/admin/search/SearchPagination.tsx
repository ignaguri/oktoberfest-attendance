"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useCallback } from "react";

export interface SearchPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
  maxVisiblePages?: number;
  showInfo?: boolean;
  totalItems?: number;
  itemsPerPage?: number;
}

export function SearchPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showPageNumbers = true,
  maxVisiblePages = 5,
  showInfo = true,
  totalItems,
  itemsPerPage,
}: SearchPaginationProps) {
  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages && page !== currentPage) {
        onPageChange(page);
      }
    },
    [currentPage, totalPages, onPageChange],
  );

  const getVisiblePages = useCallback(() => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }, [currentPage, totalPages, maxVisiblePages]);

  const visiblePages = getVisiblePages();
  const showStartEllipsis = visiblePages[0] > 1;
  const showEndEllipsis = visiblePages[visiblePages.length - 1] < totalPages;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {showInfo && totalItems && itemsPerPage && (
        <div className="text-muted-foreground text-sm">
          Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}{" "}
          to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
          results
        </div>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
          title="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {showPageNumbers && (
          <>
            {showStartEllipsis && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  className="h-8 w-8 p-0"
                  title="Go to first page"
                >
                  1
                </Button>
                <div className="flex h-8 w-8 items-center justify-center">
                  <MoreHorizontal className="text-muted-foreground h-4 w-4" />
                </div>
              </>
            )}

            {visiblePages.map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page)}
                className="h-8 w-8 p-0"
                title={`Go to page ${page}`}
              >
                {page}
              </Button>
            ))}

            {showEndEllipsis && (
              <>
                <div className="flex h-8 w-8 items-center justify-center">
                  <MoreHorizontal className="text-muted-foreground h-4 w-4" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  className="h-8 w-8 p-0"
                  title="Go to last page"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
          title="Go to next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
