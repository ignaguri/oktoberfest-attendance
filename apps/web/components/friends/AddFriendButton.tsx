"use client";

import {
  useFriendshipStatus,
  useSendFriendRequest,
} from "@prostcounter/shared/hooks";
import { Check, Clock, Loader2, UserPlus } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface AddFriendButtonProps {
  userId: string;
  /** Pre-fetched status to avoid extra API call when parent already has it */
  initialStatus?: "friends" | "pending_sent" | "pending_received" | "none";
  className?: string;
  size?: "default" | "sm";
  onRespond?: () => void;
}

export function AddFriendButton({
  userId,
  initialStatus,
  className,
  size = "default",
  onRespond,
}: AddFriendButtonProps) {
  const { t } = useTranslation();
  const { data: statusData, loading: statusLoading } = useFriendshipStatus(
    initialStatus ? undefined : userId,
  );
  const sendRequest = useSendFriendRequest();

  const status = initialStatus ?? statusData?.status ?? "none";

  const handleSendRequest = useCallback(async () => {
    try {
      await sendRequest.mutateAsync(userId);
    } catch {
      // Error handled by mutation
    }
  }, [sendRequest, userId]);

  if (statusLoading && !initialStatus) {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  switch (status) {
    case "friends":
      return (
        <Button
          variant="outline"
          size={size}
          disabled
          className={cn(
            "border-green-300 text-green-700 hover:bg-green-50",
            className,
          )}
        >
          <Check className="size-4" />
          {t("friends.status.friends")}
        </Button>
      );

    case "pending_sent":
      return (
        <Button
          variant="outline"
          size={size}
          disabled
          className={cn("text-muted-foreground", className)}
        >
          <Clock className="size-4" />
          {t("friends.status.pendingSent")}
        </Button>
      );

    case "pending_received":
      return (
        <Button
          variant="outline"
          size={size}
          onClick={onRespond}
          className={className}
        >
          {t("friends.status.pendingReceived")}
        </Button>
      );

    case "none":
    default:
      return (
        <Button
          variant="yellow"
          size={size}
          onClick={handleSendRequest}
          disabled={sendRequest.loading}
          className={className}
        >
          {sendRequest.loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {t("friends.request.send")}
        </Button>
      );
  }
}
