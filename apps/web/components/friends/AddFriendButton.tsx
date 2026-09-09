"use client";

import {
  useCancelFriendRequest,
  useFriendshipStatus,
  useSendFriendRequest,
} from "@prostcounter/shared/hooks";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface AddFriendButtonProps {
  userId: string;
  /** Pre-fetched status to avoid extra API call when parent already has it */
  initialStatus?: "friends" | "pending_sent" | "pending_received" | "none";
  /** The friendship row behind initialStatus. Cancelling a sent request needs it. */
  initialFriendshipId?: string | null;
  className?: string;
  size?: "default" | "sm";
  onRespond?: () => void;
}

export function AddFriendButton({
  userId,
  initialStatus,
  initialFriendshipId,
  className,
  size = "default",
  onRespond,
}: AddFriendButtonProps) {
  const { t } = useTranslation();
  const { data: statusData, loading: statusLoading } = useFriendshipStatus(
    initialStatus ? undefined : userId,
  );
  const sendRequest = useSendFriendRequest();
  const cancelRequest = useCancelFriendRequest();

  const status = initialStatus ?? statusData?.status ?? "none";
  const friendshipId = initialStatus
    ? (initialFriendshipId ?? null)
    : (statusData?.friendshipId ?? null);

  const handleSendRequest = useCallback(async () => {
    try {
      await sendRequest.mutateAsync(userId);
    } catch {
      // Error handled by mutation
    }
  }, [sendRequest, userId]);

  const handleCancelRequest = useCallback(async () => {
    if (!friendshipId) {
      return;
    }
    try {
      await cancelRequest.mutateAsync(friendshipId);
    } catch {
      // Error handled by mutation
    }
  }, [cancelRequest, friendshipId]);

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
          className={cn("border-green-300 text-green-700 hover:bg-green-50", className)}
        >
          <Check className="size-4" />
          {t("friends.status.friends")}
        </Button>
      );

    case "pending_sent":
      // Without the friendship id there is nothing to cancel, so the button
      // stays inert rather than offering an action it cannot carry out.
      return (
        <Button
          variant="outline"
          size={size}
          onClick={handleCancelRequest}
          disabled={!friendshipId || cancelRequest.loading}
          className={cn("text-muted-foreground", className)}
        >
          {cancelRequest.loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          {t("friends.request.cancel")}
        </Button>
      );

    case "pending_received":
      return (
        <Button
          variant="outline"
          size={size}
          onClick={onRespond}
          disabled={!onRespond}
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
