"use client";

import { useFriendSuggestions } from "@prostcounter/shared/hooks";
import type { FriendSuggestion } from "@prostcounter/shared/schemas";
import { Sparkles } from "lucide-react";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { AddFriendButton } from "@/components/friends/AddFriendButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          {t("friends.suggestions.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion: FriendSuggestion) => (
          <div
            key={suggestion.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <AvatarPreview
              url={suggestion.avatarUrl}
              previewUrl={null}
              size="small"
              fallback={{
                username: suggestion.username,
                full_name: suggestion.fullName,
                email: suggestion.username || "user",
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {suggestion.fullName || suggestion.username}
              </p>
              {suggestion.username && suggestion.fullName && (
                <p className="text-muted-foreground truncate text-sm">
                  @{suggestion.username}
                </p>
              )}
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SuggestionsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
