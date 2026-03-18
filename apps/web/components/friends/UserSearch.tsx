"use client";

import { useSearchUsers } from "@prostcounter/shared/hooks";
import type { SearchUserResult } from "@prostcounter/shared/schemas";
import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { AddFriendButton } from "@/components/friends/AddFriendButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/client";

export function UserSearch() {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results, loading } = useSearchUsers(debouncedQuery);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => {
      if (!prev) {
        setTimeout(() => inputRef.current?.focus(), 0);
      } else {
        setQuery("");
      }
      return !prev;
    });
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const showDropdown = isExpanded && debouncedQuery.length >= 1;

  const sortedResults = useMemo(() => {
    if (!results) return [];
    return [...results].sort((a: SearchUserResult, b: SearchUserResult) => {
      // Friends go to the end
      if (a.friendshipStatus === "friends" && b.friendshipStatus !== "friends")
        return 1;
      if (a.friendshipStatus !== "friends" && b.friendshipStatus === "friends")
        return -1;
      // Alphabetical by name
      const nameA = (a.fullName || a.username || "").toLowerCase();
      const nameB = (b.fullName || b.username || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [results]);

  return (
    <div
      ref={containerRef}
      className={isExpanded ? "relative flex-1" : "relative ml-auto"}
    >
      {isExpanded ? (
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            placeholder={t("friends.search.placeholder")}
            value={query}
            onChange={handleInputChange}
            className="w-full pl-9"
          />
          {loading && debouncedQuery.length >= 1 && (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
          )}
        </div>
      ) : (
        <Button variant="outline" size="icon" onClick={handleToggle}>
          <Search className="size-4" />
        </Button>
      )}

      {showDropdown && (
        <div className="bg-popover absolute top-full right-0 z-50 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border shadow-lg sm:w-80">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : sortedResults.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              {t("friends.search.noResults")}
            </div>
          ) : (
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0 p-1">
              {sortedResults.map((user: SearchUserResult) => (
                <div
                  key={user.id}
                  className="hover:bg-accent col-span-3 grid grid-cols-subgrid items-center rounded-md px-2 py-2"
                >
                  <AvatarPreview
                    url={user.avatarUrl}
                    previewUrl={null}
                    size="small"
                    fallback={{
                      username: user.username,
                      full_name: user.fullName,
                      email: user.username || "user",
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {user.fullName || user.username}
                    </p>
                    {user.username && (
                      <p className="text-muted-foreground truncate text-xs">
                        @{user.username}
                      </p>
                    )}
                  </div>
                  <AddFriendButton
                    userId={user.id}
                    initialStatus={user.friendshipStatus}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
