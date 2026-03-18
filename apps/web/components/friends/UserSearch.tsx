"use client";

import { useSearchUsers } from "@prostcounter/shared/hooks";
import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { AddFriendButton } from "@/components/friends/AddFriendButton";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface UserSearchProps {
  className?: string;
}

export function UserSearch({ className }: UserSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsOpen(true);
    },
    [],
  );

  const showDropdown = isOpen && debouncedQuery.length >= 1;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder={t("friends.search.placeholder")}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="pl-9"
        />
        {loading && debouncedQuery.length >= 1 && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="bg-popover absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-md border shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : !results || results.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              {t("friends.search.noResults")}
            </div>
          ) : (
            <div className="p-1">
              {results.map(
                (user: {
                  id: string;
                  username: string | null;
                  fullName: string | null;
                  avatarUrl: string | null;
                }) => (
                  <div
                    key={user.id}
                    className="hover:bg-accent flex items-center gap-3 rounded-md p-2"
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {user.fullName || user.username}
                      </p>
                      {user.username && (
                        <p className="text-muted-foreground truncate text-xs">
                          @{user.username}
                        </p>
                      )}
                    </div>
                    <AddFriendButton userId={user.id} size="sm" />
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
