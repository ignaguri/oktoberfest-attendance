"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

export interface SearchState {
  search: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  filters: Record<string, any>;
}

export interface UseSearchStateOptions {
  defaultSearch?: string;
  defaultPage?: number;
  defaultLimit?: number;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultFilters?: Record<string, any>;
  debounceMs?: number;
  syncWithUrl?: boolean;
  urlParamPrefix?: string;
}

interface BuildSearchStateUrlOptions {
  location: { pathname: string; search: string; hash: string };
  prefix: string;
  defaults: Pick<SearchState, "limit" | "sortBy" | "sortOrder">;
}

/**
 * Writes the hook's own params into the current URL. Params the hook does not
 * own (e.g. the admin `?tab=`) and the hash (the admin tab) are kept, so two
 * pages sharing a URL don't wipe each other's state.
 */
export function buildSearchStateUrl(
  state: SearchState,
  { location, prefix, defaults }: BuildSearchStateUrlOptions,
): string {
  // Start from the current URL (read from location, not searchParams, to
  // avoid a circular effect dependency) minus the params this hook owns
  const params = new URLSearchParams(location.search);
  const ownedKeys = ["search", "page", "limit", "sortBy", "sortOrder"].map(
    (key) => `${prefix}${key}`,
  );
  // Snapshot the keys: deleting while iterating the live iterator skips entries
  for (const key of Array.from(params.keys())) {
    if (ownedKeys.includes(key) || key.startsWith(`${prefix}filter_`)) {
      params.delete(key);
    }
  }

  if (state.search) {
    params.set(`${prefix}search`, state.search);
  }

  if (state.page > 1) {
    params.set(`${prefix}page`, state.page.toString());
  }

  if (state.limit !== defaults.limit) {
    params.set(`${prefix}limit`, state.limit.toString());
  }

  if (state.sortBy !== defaults.sortBy) {
    params.set(`${prefix}sortBy`, state.sortBy);
  }

  if (state.sortOrder !== defaults.sortOrder) {
    params.set(`${prefix}sortOrder`, state.sortOrder);
  }

  Object.entries(state.filters).forEach(([key, value]) => {
    if (value !== "" && value != null) {
      params.set(`${prefix}filter_${key}`, String(value));
    }
  });

  const paramsString = params.toString();
  const query = paramsString ? `?${paramsString}` : "";
  return `${location.pathname}${query}${location.hash}`;
}

export function useSearchState(options: UseSearchStateOptions = {}) {
  const {
    defaultSearch = "",
    defaultPage = 1,
    defaultLimit = 50,
    defaultSortBy = "created_at",
    defaultSortOrder = "desc",
    defaultFilters = {},
    debounceMs = 300,
    syncWithUrl = true,
    urlParamPrefix = "",
  } = options;

  const router = useRouter();
  const searchParams = useSearchParams();

  // Track the last URL we set to prevent infinite loops
  const lastUrlRef = useRef<string | null>(null);

  // Initialize state from URL or defaults
  const [state, setState] = useState<SearchState>(() => {
    if (syncWithUrl) {
      return {
        search: searchParams.get(`${urlParamPrefix}search`) || defaultSearch,
        page: parseInt(searchParams.get(`${urlParamPrefix}page`) || "1", 10) || defaultPage,
        limit: parseInt(searchParams.get(`${urlParamPrefix}limit`) || "50", 10) || defaultLimit,
        sortBy: searchParams.get(`${urlParamPrefix}sortBy`) || defaultSortBy,
        sortOrder:
          (searchParams.get(`${urlParamPrefix}sortOrder`) as "asc" | "desc") || defaultSortOrder,
        filters: Object.fromEntries(
          searchParams
            .entries()
            .filter(([key]) => key.startsWith(`${urlParamPrefix}filter_`))
            .map(([key, value]) => [key.replace(`${urlParamPrefix}filter_`, ""), value]),
        ),
      };
    }

    return {
      search: defaultSearch,
      page: defaultPage,
      limit: defaultLimit,
      sortBy: defaultSortBy,
      sortOrder: defaultSortOrder,
      filters: defaultFilters,
    };
  });

  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState(state.search);

  // Update URL when state changes
  useEffect(() => {
    if (syncWithUrl) {
      const { pathname, search, hash } = window.location;
      const newUrl = buildSearchStateUrl(state, {
        location: { pathname, search, hash },
        prefix: urlParamPrefix,
        defaults: { limit: defaultLimit, sortBy: defaultSortBy, sortOrder: defaultSortOrder },
      });

      // Only update URL if it's different from what we last set
      // This prevents infinite loops when router.replace triggers searchParams update
      if (newUrl !== lastUrlRef.current) {
        lastUrlRef.current = newUrl;
        // Skip no-op navigations, e.g. on mount when the URL already matches
        if (newUrl !== `${pathname}${search}${hash}`) {
          router.replace(newUrl, { scroll: false });
        }
      }
    }
  }, [state, syncWithUrl, urlParamPrefix, defaultLimit, defaultSortBy, defaultSortOrder, router]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(state.search);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [state.search, debounceMs]);

  // Reset page when search changes
  useEffect(() => {
    if (debouncedSearch !== state.search) {
      startTransition(() => {
        setState((prev) => ({ ...prev, page: 1 }));
      });
    }
  }, [debouncedSearch, state.search]);

  const updateSearch = useCallback((search: string) => {
    setState((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const updatePage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const updateLimit = useCallback((limit: number) => {
    setState((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const updateSorting = useCallback((sortBy: string, sortOrder: "asc" | "desc") => {
    setState((prev) => ({ ...prev, sortBy, sortOrder, page: 1 }));
  }, []);

  const updateFilter = useCallback((key: string, value: any) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
      page: 1,
    }));
  }, []);

  const updateFilters = useCallback((filters: Record<string, any>) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, ...filters },
      page: 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filters: {},
      page: 1,
    }));
  }, []);

  const clearSearch = useCallback(() => {
    setState((prev) => ({
      ...prev,
      search: "",
      page: 1,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      search: defaultSearch,
      page: defaultPage,
      limit: defaultLimit,
      sortBy: defaultSortBy,
      sortOrder: defaultSortOrder,
      filters: defaultFilters,
    });
  }, [defaultSearch, defaultPage, defaultLimit, defaultSortBy, defaultSortOrder, defaultFilters]);

  return {
    // State
    search: state.search,
    debouncedSearch,
    page: state.page,
    limit: state.limit,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    filters: state.filters,

    // Actions
    updateSearch,
    updatePage,
    updateLimit,
    updateSorting,
    updateFilter,
    updateFilters,
    clearFilters,
    clearSearch,
    reset,

    // Computed
    hasActiveFilters: Object.values(state.filters).some(
      (value) => value !== "" && value != null && (Array.isArray(value) ? value.length > 0 : true),
    ),
    hasSearch: state.search.trim() !== "",
  };
}
