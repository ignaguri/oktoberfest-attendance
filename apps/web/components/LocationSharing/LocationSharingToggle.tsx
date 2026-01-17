"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { MapPin, MapPinOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLocationSharing } from "@/hooks/useLocationSharing";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface LocationSharingToggleProps {
  className?: string;
  disabled?: boolean;
  isSharing?: boolean;
  hasGroupSharingEnabled?: boolean;
  onToggle?: () => void;
}

export const LocationSharingToggle = ({
  className,
  disabled = false,
  isSharing = false,
  hasGroupSharingEnabled = false,
  onToggle,
}: LocationSharingToggleProps) => {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const {
    startLocationSharing,
    stopLocationSharing,
    isUpdatingLocation,
    isStoppingSharing,
  } = useLocationSharing(currentFestival?.id);

  console.log("LocationSharingToggle - Current festival:", currentFestival?.id);
  console.log(
    "LocationSharingToggle - Has group sharing enabled:",
    hasGroupSharingEnabled,
  );
  console.log("LocationSharingToggle - Is sharing:", isSharing);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const isLoading = isUpdatingLocation || isStoppingSharing;

  // True sharing state: geolocation watch is active AND group sharing is enabled
  const isActuallySharing = isSharing && hasGroupSharingEnabled;

  // Check geolocation permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (!navigator.geolocation) {
        setHasPermission(false);
        return;
      }

      try {
        // Try to use Permissions API, but fall back gracefully
        const permission = await navigator.permissions.query({
          name: "geolocation",
        });
        setHasPermission(permission.state === "granted");

        permission.addEventListener("change", () => {
          setHasPermission(permission.state === "granted");
        });
      } catch (error) {
        // Permissions API not supported, we'll check permission on first use
        setHasPermission(null);
      }
    };

    checkPermission();
  }, [isSharing]);

  const handleToggle = async () => {
    if (disabled || isLoading || !currentFestival) return;

    // Use custom onToggle if provided
    if (onToggle) {
      onToggle();
      return;
    }

    try {
      if (!isActuallySharing) {
        // Request location permission and start sharing
        if (!navigator.geolocation) {
          toast.error(t("notifications.error.geolocationNotSupported"));
          return;
        }

        await startLocationSharing();
        setHasPermission(true);

        // Show appropriate message based on group sharing status
        if (hasGroupSharingEnabled) {
          toast.success(t("location.sharing.enabled"));
        } else {
          toast.success(t("location.sharing.trackingStarted"));
        }
      } else {
        // Stop sharing
        await stopLocationSharing();
        toast.success(t("notifications.success.locationSharingDisabled"));
      }
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error(t("notifications.error.permissionDenied"), {
              description: t("notifications.descriptions.permissionDenied"),
            });
            setHasPermission(false);
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error(t("notifications.error.locationUnavailable"));
            break;
          case error.TIMEOUT:
            toast.error(t("notifications.error.locationTimeout"));
            break;
        }
      } else {
        const errorMessage =
          error instanceof Error
            ? error.message
            : t("notifications.error.generic");

        // Handle specific API errors
        if (
          errorMessage.includes("Location sharing not enabled for any groups")
        ) {
          toast.error(t("location.sharing.noGroupsEnabled"));
        } else {
          toast.error(errorMessage);
        }
      }
    }
  };

  const getButtonVariant = () => {
    if (isActuallySharing) return "default";
    return "outline";
  };

  const getButtonClass = () => {
    if (isActuallySharing) {
      return "bg-green-100 hover:bg-green-200 border-green-300 text-green-800";
    }
    return "hover:bg-yellow-50 hover:border-yellow-300";
  };

  const isButtonDisabled = disabled || isLoading || !navigator.geolocation;

  const getTooltipText = () => {
    if (isActuallySharing) {
      return "You're sharing your live location with group members. Click to stop.";
    }
    if (isSharing && !hasGroupSharingEnabled) {
      return "Location tracking is active, but no groups are enabled to see your location. Configure sharing in your profile settings.";
    }
    if (!navigator.geolocation) {
      return "Geolocation is not supported by this browser";
    }
    if (hasPermission === false) {
      return "Location access denied. Please enable location permissions in your browser settings and refresh the page.";
    }
    return "Share your live location with group members";
  };

  return (
    <Button
      type="button"
      variant={getButtonVariant()}
      size="sm"
      onClick={handleToggle}
      disabled={isButtonDisabled}
      className={cn(getButtonClass(), className)}
      title={getTooltipText()}
    >
      {isLoading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : isActuallySharing ? (
        <MapPin className="h-4 w-4 text-green-600" />
      ) : (
        <MapPinOff className="h-4 w-4" />
      )}
    </Button>
  );
};
