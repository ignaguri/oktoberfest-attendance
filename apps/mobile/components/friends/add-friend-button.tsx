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
  }
> = {
  none: {
    labelKey: "friends.request.send",
    icon: UserPlus,
    variant: "solid",
    action: "primary",
    iconColor: IconColors.white,
    spinnerColor: IconColors.white,
  },
  pending_sent: {
    labelKey: "friends.request.sent",
    icon: Clock,
    variant: "outline",
    action: "secondary",
    iconColor: IconColors.muted,
    spinnerColor: Colors.gray[500],
  },
  pending_received: {
    labelKey: "friends.request.accept",
    icon: UserCheck,
    variant: "outline",
    action: "primary",
    iconColor: IconColors.primary,
    spinnerColor: Colors.primary[500],
  },
  friends: {
    labelKey: "friends.status.friends",
    icon: Check,
    variant: "outline",
    action: "positive",
    iconColor: IconColors.success,
    spinnerColor: Colors.success[500],
  },
};

export function AddFriendButton({
  status,
  onPress,
  loading = false,
  size = "md",
}: AddFriendButtonProps) {
  const { t } = useTranslation();

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const iconSize = size === "sm" ? 14 : 16;

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const accessibilityLabel = useMemo(() => {
    return t(config.labelKey);
  }, [t, config.labelKey]);

  return (
    <Button
      variant={config.variant}
      action={config.action}
      size={size}
      onPress={handlePress}
      disabled={loading || status === "friends"}
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
