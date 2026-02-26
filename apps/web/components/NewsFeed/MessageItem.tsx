"use client";

import type { GroupMessageFeedItem } from "@prostcounter/shared/schemas";
import { AlertTriangle, Pin } from "lucide-react";
import { useMemo } from "react";

import Avatar from "@/components/Avatar/Avatar";
import { Badge } from "@/components/ui/badge";
import { ProfilePreview } from "@/components/ui/profile-preview";
import { formatRelativeTime } from "@/lib/date-utils";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface MessageItemProps {
  message: GroupMessageFeedItem;
  festivalId?: string;
}

export const MessageItem = ({ message, festivalId }: MessageItemProps) => {
  const { t } = useTranslation();
  const isAlert = message.messageType === "alert";
  const isPinned = message.pinned;

  const timeAgo = useMemo(() => {
    try {
      return formatRelativeTime(new Date(message.createdAt));
    } catch {
      return "";
    }
  }, [message.createdAt]);

  const displayName =
    message.username || message.fullName || t("common.unknown");

  return (
    <div
      className={cn(
        "border-border/50 flex items-start gap-3 border-b py-2 last:border-b-0",
        isAlert && "bg-amber-50",
      )}
    >
      {/* User Avatar */}
      <ProfilePreview
        userId={message.userId}
        festivalId={festivalId}
        username={message.username}
        fullName={message.fullName}
        avatarUrl={message.avatarUrl}
        className="flex-shrink-0"
      >
        <Avatar
          url={message.avatarUrl}
          fallback={{
            username: message.username,
            full_name: message.fullName,
            email: "no.name@user.com",
          }}
        />
      </ProfilePreview>

      {/* Message Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium transition-colors hover:text-yellow-600">
              {displayName}
            </span>
            {message.groupName && (
              <Badge
                variant="outline"
                className="text-muted-foreground text-xs"
              >
                {message.groupName}
              </Badge>
            )}
            {isAlert && <AlertTriangle className="size-3.5 text-yellow-600" />}
            {isPinned && <Pin className="text-muted-foreground size-3" />}
          </div>
          <span className="text-muted-foreground text-xs">{timeAgo}</span>
        </div>

        <p className="text-muted-foreground text-left text-sm">
          {message.content}
        </p>

        {isAlert && (
          <Badge className="mt-1 bg-yellow-500 text-xs text-white hover:bg-yellow-600">
            {t("groups.messages.item.alert")}
          </Badge>
        )}
      </div>
    </div>
  );
};
