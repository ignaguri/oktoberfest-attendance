"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useSearchState } from "@/hooks/useSearchState";
import { useUserSearch, useUserSearchMutations } from "@/hooks/useUserSearch";
import { cn } from "@/lib/utils";
import { Filter, SortAsc, SortDesc, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useEffect } from "react";

import type { UserSearchFilters } from "@/lib/data/search-query-keys";

import { SearchFilters, type SearchFilter } from "./SearchFilters";
import { SearchHighlight } from "./SearchHighlight";
import { SearchInput } from "./SearchInput";
import { SearchPagination } from "./SearchPagination";
import { SearchResults } from "./SearchResults";
import { SearchSuggestions } from "./SearchSuggestions";

export interface UserSearchProps {
  className?: string;
  showFilters?: boolean;
  showSorting?: boolean;
  showRefresh?: boolean;
  onUserEdit?: (user: any) => void;
  onUserDelete?: (userId: string) => void;
  onRefresh?: () => void;
  renderUserItem?: (user: any) => React.ReactNode;
}

export function UserSearch({
  className,
  showFilters = true,
  showSorting = true,
  showRefresh = true,
  onUserEdit,
  onUserDelete,
  onRefresh,
  renderUserItem,
}: UserSearchProps) {
  const searchState = useSearchState({
    defaultLimit: 50,
    syncWithUrl: true,
    urlParamPrefix: "user_",
  });

  const searchFilters: UserSearchFilters = useMemo(
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
  } = useUserSearch(searchFilters);

  // Type guard to ensure searchResult has the expected structure
  const hasValidSearchResult =
    searchResult && "users" in searchResult && "totalCount" in searchResult;

  const { invalidateUserQueries } = useUserSearchMutations();
  const searchHistory = useSearchHistory({ storageKey: "user-search-history" });

  const handleRefresh = useCallback(() => {
    invalidateUserQueries();
    refetch();
    onRefresh?.();
  }, [invalidateUserQueries, refetch, onRefresh]);

  // Compute suggestions (computation is cheap, no need for memoization)
  const recent = searchHistory.getRecentQueries(3);
  const popular = searchHistory.getPopularQueries(2);
  const suggestionsList = searchHistory.getSuggestions(searchState.search, 3);
  const suggestions = [...recent, ...popular, ...suggestionsList];

  // Add search to history when search completes
  useEffect(() => {
    if (searchResult && searchState.debouncedSearch) {
      searchHistory.addToHistory(
        searchState.debouncedSearch,
        searchResult.totalCount,
        searchState.filters,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult?.totalCount, searchState.debouncedSearch]);

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

  const handleSuggestionSelect = useCallback(
    (suggestion: any) => {
      searchState.updateSearch(suggestion.text);
    },
    [searchState],
  );

  const handleSortCreatedAt = useCallback(() => {
    handleSort("created_at");
  }, [handleSort]);

  const handleSortName = useCallback(() => {
    handleSort("full_name");
  }, [handleSort]);

  const filters: SearchFilter[] = useMemo(
    () => [
      {
        key: "isSuperAdmin",
        label: "Super Admin",
        type: "checkbox",
        options: [{ value: "true", label: "Super Admins Only" }],
        value: searchState.filters.isSuperAdmin || false,
        onChange: (value) => searchState.updateFilter("isSuperAdmin", value),
      },
      {
        key: "hasProfile",
        label: "Has Profile",
        type: "checkbox",
        options: [{ value: "true", label: "Has Complete Profile" }],
        value: searchState.filters.hasProfile || false,
        onChange: (value) => searchState.updateFilter("hasProfile", value),
      },
    ],
    [searchState],
  );

  const defaultRenderUserItem = useCallback(
    (user: any) => (
      <div
        key={user.id}
        className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-lg">
              <SearchHighlight
                text={user.profile?.full_name || "N/A"}
                searchTerm={searchState.search}
                highlightClassName="bg-yellow-200 font-semibold"
              />
            </h3>
            {user.profile?.is_super_admin && (
              <Badge variant="secondary" className="text-xs">
                Admin
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {user.profile?.username && (
              <span className="mr-2">
                @
                <SearchHighlight
                  text={user.profile.username}
                  searchTerm={searchState.search}
                  highlightClassName="bg-yellow-200 font-semibold"
                />
              </span>
            )}
            <span>
              [
              <SearchHighlight
                text={user.email}
                searchTerm={searchState.search}
                highlightClassName="bg-yellow-200 font-semibold"
              />
              ]
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Created: {new Date(user.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex gap-2">
          {onUserEdit && (
            <Button
              onClick={() => onUserEdit(user)}
              size="sm"
              title="Edit user information"
            >
              Edit
            </Button>
          )}
          {onUserDelete && (
            <Button
              onClick={() => onUserDelete(user.id)}
              size="sm"
              variant="destructive"
              title="Delete user permanently"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    ),
    [onUserEdit, onUserDelete, searchState.search],
  );

  const renderItem = (renderUserItem || defaultRenderUserItem) as (
    user: any,
  ) => React.ReactNode;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <SearchInput
            value={searchState.search}
            onChange={searchState.updateSearch}
            onClear={searchState.clearSearch}
            placeholder="Search users by name, username, or email..."
            isLoading={isLoading}
            debounceMs={300}
          />
        </div>

        <div className="flex items-center gap-2">
          <SearchSuggestions
            suggestions={suggestions}
            onSuggestionSelect={handleSuggestionSelect}
            onClearHistory={searchHistory.clearHistory}
            maxSuggestions={8}
          />

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
                onClick={handleSortCreatedAt}
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
                onClick={handleSortName}
                className={cn(searchState.sortBy === "full_name" && "bg-muted")}
                title={`Sort by name (${searchState.sortBy === "full_name" && searchState.sortOrder === "asc" ? "descending" : "ascending"})`}
              >
                {searchState.sortBy === "full_name" &&
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              {searchResult.totalCount} user
              {searchResult.totalCount !== 1 ? "s" : ""} found
            </span>
            {searchState.hasSearch && (
              <Badge variant="outline">
                &ldquo;{searchState.search}&rdquo;
              </Badge>
            )}
            {searchState.hasActiveFilters && (
              <Badge variant="outline">
                <Filter className="h-3 w-3 mr-1" />
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
          title="User Filters"
          collapsible={true}
          defaultCollapsed={true}
        />
      )}

      {/* Search Results */}
      <SearchResults
        isLoading={isLoading}
        isEmpty={
          !isLoading && hasValidSearchResult && searchResult.users.length === 0
        }
        emptyMessage="No users found"
        searchTerm={searchState.search}
      >
        <div className="space-y-2">
          {hasValidSearchResult && searchResult.users.map(renderItem)}
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
        <div className="text-center py-8">
          <p className="text-destructive mb-4">
            Error loading users: {error.message}
          </p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
