"use client";

import {
  Calendar,
  Filter,
  RefreshCw,
  SortAsc,
  SortDesc,
  Users,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useGroupSearch,
  useGroupSearchMutations,
} from "@/hooks/useGroupSearch";
import { useSearchState } from "@/hooks/useSearchState";
import type { GroupSearchFilters } from "@/lib/data/search-query-keys";
import { cn } from "@/lib/utils";

import { type SearchFilter, SearchFilters } from "./SearchFilters";
import { SearchInput } from "./SearchInput";
import { SearchPagination } from "./SearchPagination";
import { SearchResults } from "./SearchResults";

export interface GroupSearchProps {
  className?: string;
  showFilters?: boolean;
  showSorting?: boolean;
  showRefresh?: boolean;
  onGroupEdit?: (group: any) => void;
  onGroupDelete?: (groupId: string) => void;
  onRefresh?: () => void;
  renderGroupItem?: (group: any) => React.ReactNode;
}

export function GroupSearch({
  className,
  showFilters = true,
  showSorting = true,
  showRefresh = true,
  onGroupEdit,
  onGroupDelete,
  onRefresh,
  renderGroupItem,
}: GroupSearchProps) {
  const searchState = useSearchState({
    defaultLimit: 50,
    syncWithUrl: true,
    urlParamPrefix: "group_",
  });

  const searchFilters: GroupSearchFilters = useMemo(
    () => ({
      search: searchState.debouncedSearch,
      page: searchState.page,
      limit: searchState.limit,
      sortBy: searchState.sortBy,
      sortOrder: searchState.sortOrder,
      ...searchState.filters,
    }),
    [searchState],
  );

  const {
    data: searchResult,
    isLoading,
    error,
    refetch,
  } = useGroupSearch(searchFilters);

  // Type guard to ensure searchResult has the expected structure
  const hasValidSearchResult =
    searchResult && "groups" in searchResult && "totalCount" in searchResult;

  const { invalidateGroupQueries } = useGroupSearchMutations();

  const handleRefresh = useCallback(() => {
    invalidateGroupQueries();
    refetch();
    onRefresh?.();
  }, [invalidateGroupQueries, refetch, onRefresh]);

  const handleSort = useCallback(
    (sortBy: string) => {
      const newSortOrder =
        searchState.sortBy === sortBy && searchState.sortOrder === "asc"
          ? "desc"
          : "asc";
      searchState.updateSorting(sortBy, newSortOrder);
    },
    [searchState],
  );

  const filters: SearchFilter[] = useMemo(
    () => [
      {
        key: "hasMembers",
        label: "Members",
        type: "checkbox",
        options: [{ value: "true", label: "Has Members" }],
        value: searchState.filters.hasMembers || false,
        onChange: (value) => searchState.updateFilter("hasMembers", value),
      },
    ],
    [searchState],
  );

  const defaultRenderGroupItem = useCallback(
    (group: any) => (
      <div
        key={group.id}
        className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-lg font-medium">{group.name}</h3>
          </div>
          {group.description && (
            <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">
              {group.description}
            </p>
          )}
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{group.member_count || 0} members</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                Created {new Date(group.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {onGroupEdit && (
            <Button
              onClick={() => onGroupEdit(group)}
              size="sm"
              title="Edit group information"
            >
              Edit
            </Button>
          )}
          {onGroupDelete && (
            <Button
              onClick={() => onGroupDelete(group.id)}
              size="sm"
              variant="destructive"
              title="Delete group permanently"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    ),
    [onGroupEdit, onGroupDelete],
  );

  const renderItem = (renderGroupItem || defaultRenderGroupItem) as (
    group: any,
  ) => React.ReactNode;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="w-full flex-1 sm:max-w-md">
          <SearchInput
            value={searchState.search}
            onChange={searchState.updateSearch}
            onClear={searchState.clearSearch}
            placeholder="Search groups by name or description..."
            isLoading={isLoading}
            debounceMs={300}
          />
        </div>

        <div className="flex items-center gap-2">
          {showRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh search results"
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
            </Button>
          )}

          {showSorting && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSort("created_at")}
                className={cn(
                  searchState.sortBy === "created_at" && "bg-muted",
                )}
                title={`Sort by creation date (${searchState.sortBy === "created_at" && searchState.sortOrder === "asc" ? "descending" : "ascending"})`}
              >
                {searchState.sortBy === "created_at" &&
                searchState.sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSort("name")}
                className={cn(searchState.sortBy === "name" && "bg-muted")}
                title={`Sort by name (${searchState.sortBy === "name" && searchState.sortOrder === "asc" ? "descending" : "ascending"})`}
              >
                {searchState.sortBy === "name" &&
                searchState.sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Search Results Info */}
      {hasValidSearchResult && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span>
              {searchResult.totalCount} group
              {searchResult.totalCount !== 1 ? "s" : ""} found
            </span>
            {searchState.hasSearch && (
              <Badge variant="outline">
                &ldquo;{searchState.search}&rdquo;
              </Badge>
            )}
            {searchState.hasActiveFilters && (
              <Badge variant="outline">
                <Filter className="mr-1 h-3 w-3" />
                Filtered
              </Badge>
            )}
          </div>
          <div>
            Page {searchResult.currentPage} of {searchResult.totalPages}
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <SearchFilters
          filters={filters}
          onClearAll={searchState.clearFilters}
          title="Group Filters"
          collapsible={true}
          defaultCollapsed={true}
        />
      )}

      {/* Search Results */}
      <SearchResults
        isLoading={isLoading}
        isEmpty={
          !isLoading && hasValidSearchResult && searchResult.groups.length === 0
        }
        emptyMessage="No groups found"
        searchTerm={searchState.search}
      >
        <div className="space-y-2">
          {hasValidSearchResult && searchResult.groups.map(renderItem)}
        </div>
      </SearchResults>

      {/* Pagination */}
      {hasValidSearchResult && searchResult.totalPages > 1 && (
        <SearchPagination
          currentPage={searchResult.currentPage}
          totalPages={searchResult.totalPages}
          onPageChange={searchState.updatePage}
          totalItems={searchResult.totalCount}
          itemsPerPage={searchState.limit}
        />
      )}

      {/* Error State */}
      {error && (
        <div className="py-8 text-center">
          <p className="text-destructive mb-4">
            Error loading groups: {error.message}
          </p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
