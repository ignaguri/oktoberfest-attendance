"use client";

import { useCurrentProfile } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupMessageItem } from "@prostcounter/shared/schemas";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { AlertTriangle, Pin, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MessageItemProps {
  message: GroupMessageItem;
  onDelete?: (messageId: string) => void;
}

export function MessageItem({ message, onDelete }: MessageItemProps) {
  const { t } = useTranslation();
  const { data: profile } = useCurrentProfile();
  const isOwn = profile?.id === message.userId;
  const displayName = message.username || message.fullName || "Unknown";

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg p-3",
        message.messageType === "alert" ? "bg-amber-50" : "bg-white",
      )}
    >
      <Avatar className="size-8 flex-shrink-0">
        <AvatarImage src={message.avatarUrl ?? undefined} />
        <AvatarFallback className="text-xs">
          {displayName[0]?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {displayName}
          </span>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(new Date(message.createdAt))}
          </span>
          {message.pinned && <Pin className="size-3 text-yellow-600" />}
          {message.messageType === "alert" && (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-100 text-xs text-amber-800"
            >
              <AlertTriangle className="mr-1 size-3" />
              {t("groups.messages.item.alert")}
            </Badge>
          )}
          {isOwn && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="ml-auto text-gray-400 hover:text-red-500"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-0.5 text-sm whitespace-pre-wrap text-gray-700">
          {message.content}
        </p>
      </div>
    </div>
  );
}
