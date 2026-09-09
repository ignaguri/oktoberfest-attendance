import { useTranslation } from "@prostcounter/shared/i18n";
import type { FriendshipStatusCheck } from "@prostcounter/shared/schemas";
import { Check, Clock, UserCheck, UserPlus } from "lucide-react-native";
import { useCallback, useMemo } from "react";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Colors, IconColors } from "@/lib/constants/colors";

type FriendshipStatus = FriendshipStatusCheck["status"];

interface AddFriendButtonProps {
  status: FriendshipStatus;
  onPress: () => void;
  /** Where "Accept" goes. Without it the button renders inert rather than sending. */
  onRespond?: () => void;
  loading?: boolean;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  FriendshipStatus,
  {
    labelKey: string;
    icon: typeof UserPlus;
    variant: "solid" | "outline";
    action: "primary" | "secondary" | "positive";
    iconColor: string;
    spinnerColor: string;
    /**
     * Which callback a press dispatches to, or null when the state is
     * terminal. Pressing a sent request only re-posts it for a 409, and
     * "Accept" must never reach onPress: that sends a second request in the
     * opposite direction instead of accepting the one already there.
     */
    press: "send" | "respond" | null;
  }
> = {
  none: {
    labelKey: "friends.request.send",
    icon: UserPlus,
    variant: "solid",
    action: "primary",
    iconColor: IconColors.white,
    spinnerColor: IconColors.white,
    press: "send",
  },
  pending_sent: {
    labelKey: "friends.request.sent",
    icon: Clock,
    variant: "outline",
    action: "secondary",
    iconColor: IconColors.muted,
    spinnerColor: Colors.gray[500],
    press: null,
  },
  pending_received: {
    labelKey: "friends.request.accept",
    icon: UserCheck,
    variant: "outline",
    action: "primary",
    iconColor: IconColors.primary,
    spinnerColor: Colors.primary[500],
    press: "respond",
  },
  friends: {
    labelKey: "friends.status.friends",
    icon: Check,
    variant: "outline",
    action: "positive",
    iconColor: IconColors.success,
    spinnerColor: Colors.success[500],
    press: null,
  },
};

export function AddFriendButton({
  status,
  onPress,
  onRespond,
  loading = false,
  size = "md",
}: AddFriendButtonProps) {
  const { t } = useTranslation();

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const iconSize = size === "sm" ? 14 : 16;

  const handlePress = useCallback(() => {
    if (config.press === "send") {
      onPress();
    } else if (config.press === "respond") {
      onRespond?.();
    }
  }, [config.press, onPress, onRespond]);

  const isDisabled =
    loading || config.press === null || (config.press === "respond" && !onRespond);

  const accessibilityLabel = useMemo(() => {
    return t(config.labelKey);
  }, [t, config.labelKey]);

  return (
    <Button
      variant={config.variant}
      action={config.action}
      size={size}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {loading ? (
        <ButtonSpinner color={config.spinnerColor} />
      ) : (
        <>
          <Icon size={iconSize} color={config.iconColor} />
          <ButtonText>{t(config.labelKey)}</ButtonText>
        </>
      )}
    </Button>
  );
}

AddFriendButton.displayName = "AddFriendButton";
