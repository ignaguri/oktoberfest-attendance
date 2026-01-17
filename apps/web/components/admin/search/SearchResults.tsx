"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";

import LoadingSpinner from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

export interface SearchResultsProps {
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  searchTerm?: string;
  className?: string;
  loadingComponent?: ReactNode;
  emptyComponent?: ReactNode;
}

export function SearchResults({
  children,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No results found",
  searchTerm,
  className,
  loadingComponent,
  emptyComponent,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        {loadingComponent || <LoadingSpinner />}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-center",
          className,
        )}
      >
        {emptyComponent || (
          <>
            <Search className="text-muted-foreground mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-lg font-medium">
              {emptyMessage}
            </p>
            {searchTerm && (
              <p className="text-muted-foreground mt-2 text-sm">
                No results found for{" "}
                <span className="font-medium">&ldquo;{searchTerm}&rdquo;</span>
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}
