"use client";

import { useFriendSuggestions } from "@prostcounter/shared/hooks";
import type { FriendSuggestion } from "@prostcounter/shared/schemas";
import { Sparkles } from "lucide-react";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { AddFriendButton } from "@/components/friends/AddFriendButton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n/client";

export function FriendSuggestions() {
  const { t } = useTranslation();
  const { data: suggestions, loading } = useFriendSuggestions();

  if (loading) {
    return <SuggestionsSkeleton />;
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-500">
        <Sparkles className="size-4" />
        {t("friends.suggestions.title")}
      </h3>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {suggestions.map((suggestion: FriendSuggestion) => (
          <Card key={suggestion.id} className="w-36 shrink-0">
            <CardContent className="flex flex-col items-center gap-2 p-3">
              <AvatarPreview
                url={suggestion.avatarUrl}
                previewUrl={null}
                size="medium"
                fallback={{
                  username: suggestion.username,
                  full_name: suggestion.fullName,
                  email: suggestion.username || "user",
                }}
              />
              <div className="w-full text-center">
                <p className="truncate text-sm font-medium">
                  {suggestion.fullName || suggestion.username}
                </p>
                {suggestion.sharedGroups > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {suggestion.sharedGroups === 1
                      ? t("friends.suggestions.sharedGroups", {
                          count: suggestion.sharedGroups,
                        })
                      : t("friends.suggestions.sharedGroupsPlural", {
                          count: suggestion.sharedGroups,
                        })}
                  </p>
                )}
              </div>
              <AddFriendButton
                userId={suggestion.id}
                initialStatus="none"
                size="sm"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function SuggestionsSkeleton() {
  return (
    <section>
      <Skeleton className="mb-2 h-5 w-40" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-lg border p-3"
          >
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </section>
  );
}
