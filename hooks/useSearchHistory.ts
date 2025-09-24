"use client";

import { useCallback, useEffect, useState } from "react";

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultCount?: number;
  filters?: Record<string, any>;
}

export interface UseSearchHistoryOptions {
  maxItems?: number;
  storageKey?: string;
  debounceMs?: number;
}

export function useSearchHistory(options: UseSearchHistoryOptions = {}) {
  const {
    maxItems = 50,
    storageKey = "search-history",
    debounceMs: _debounceMs = 1000,
  } = options;

  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.warn("Failed to load search history:", error);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // Save history to localStorage when it changes
  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (error) {
      console.warn("Failed to save search history:", error);
    }
  }, [history, storageKey, isLoaded]);

  const addToHistory = useCallback(
    (query: string, resultCount?: number, filters?: Record<string, any>) => {
      if (!query.trim()) return;

      const newItem: SearchHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        query: query.trim(),
        timestamp: Date.now(),
        resultCount,
        filters,
      };

      setHistory((prev) => {
        // Remove duplicates and add new item
        const filtered = prev.filter((item) => item.query !== newItem.query);
        const updated = [newItem, ...filtered].slice(0, maxItems);
        return updated;
      });
    },
    [maxItems],
  );

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getRecentQueries = useCallback(
    (limit = 10) => {
      return history
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          text: item.query,
          type: "recent" as const,
          resultCount: item.resultCount,
          timestamp: item.timestamp,
        }));
    },
    [history],
  );

  const getPopularQueries = useCallback(
    (limit = 5) => {
      // Count query frequency
      const queryCounts = history.reduce(
        (acc, item) => {
          acc[item.query] = (acc[item.query] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Sort by frequency and return top queries
      return Object.entries(queryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([query, count]) => ({
          id: `popular-${query}`,
          text: query,
          type: "popular" as const,
          count,
        }));
    },
    [history],
  );

  const getSuggestions = useCallback(
    (currentQuery: string, limit = 5) => {
      if (!currentQuery.trim()) return [];

      const query = currentQuery.toLowerCase();
      return history
        .filter(
          (item) =>
            item.query.toLowerCase().includes(query) &&
            item.query.toLowerCase() !== query,
        )
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          text: item.query,
          type: "suggestion" as const,
        }));
    },
    [history],
  );

  return {
    history,
    isLoaded,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentQueries,
    getPopularQueries,
    getSuggestions,
  };
}
