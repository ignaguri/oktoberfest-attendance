"use client";

import { Button } from "@/components/ui/button";
import { useFestival } from "@/contexts/FestivalContext";
import { useLocationSharing } from "@/hooks/useLocationSharing";
import { cn } from "@/lib/utils";
import { MapPin, MapPinOff } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
          toast.error("Geolocation is not supported by this browser");
          return;
        }

        await startLocationSharing();
        setHasPermission(true);

        // Show appropriate message based on group sharing status
        if (hasGroupSharingEnabled) {
          toast.success(
            "Location sharing enabled! Group members can now see your location.",
          );
        } else {
          toast.success(
            "Location tracking started! Enable location sharing for specific groups in your profile settings.",
          );
        }
      } else {
        // Stop sharing
        await stopLocationSharing();
        toast.success("Location sharing disabled.");
      }
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error(
              "Location access denied. Please enable location permissions in your browser settings.",
            );
            setHasPermission(false);
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            toast.error("Location request timed out. Please try again.");
            break;
        }
      } else {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to toggle location sharing. Please try again.";

        // Handle specific API errors
        if (
          errorMessage.includes("Location sharing not enabled for any groups")
        ) {
          toast.error(
            "Location sharing is not enabled for any groups. Please enable location sharing for at least one group in your profile settings first.",
          );
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
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isActuallySharing ? (
        <MapPin className="w-4 h-4 text-green-600" />
      ) : (
        <MapPinOff className="w-4 h-4" />
      )}
    </Button>
  );
};
