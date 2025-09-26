"use client";

import { Button } from "@/components/ui/button";
import { useFestival } from "@/contexts/FestivalContext";
import { useLocationSharing } from "@/hooks/useLocationSharing";
import { MapPin, MapPinOff } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface LocationSharingToggleProps {
  className?: string;
  disabled?: boolean;
}

export const LocationSharingToggle = ({
  className,
  disabled = false,
}: LocationSharingToggleProps) => {
  const { currentFestival } = useFestival();
  const {
    startLocationSharing,
    stopLocationSharing,
    isUpdatingLocation,
    isStoppingSharing,
    updateError,
    stopError,
    isSharing,
  } = useLocationSharing(currentFestival?.id);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const isLoading = isUpdatingLocation || isStoppingSharing;

  // Check geolocation permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (!navigator.geolocation) {
        setHasPermission(false);
        return;
      }

      try {
        const permission = await navigator.permissions.query({
          name: "geolocation",
        });
        setHasPermission(permission.state === "granted");

        permission.addEventListener("change", () => {
          setHasPermission(permission.state === "granted");
        });
      } catch (error) {
        // Fallback for browsers that don't support permissions API
        setHasPermission(null);
      }
    };

    checkPermission();
  }, [isSharing]);

  const handleToggle = async () => {
    if (disabled || isLoading || !currentFestival) return;

    try {
      if (!isSharing) {
        // Request location permission and start sharing
        if (!navigator.geolocation) {
          toast.error("Geolocation is not supported by this browser");
          return;
        }

        await startLocationSharing();
        setHasPermission(true);
        toast.success(
          "Location sharing enabled! Group members can now see your location.",
        );
      } else {
        // Stop sharing
        await stopLocationSharing();
        toast.success("Location sharing disabled.");
      }
    } catch (error) {
      console.error("Location sharing error:", error);

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
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to toggle location sharing. Please try again.",
        );
      }
    }
  };

  // Handle errors from the hook
  useEffect(() => {
    if (updateError) {
      toast.error(`Failed to update location: ${updateError.message}`);
    }
  }, [updateError]);

  useEffect(() => {
    if (stopError) {
      toast.error(`Failed to stop sharing: ${stopError.message}`);
    }
  }, [stopError]);

  const getButtonVariant = () => {
    if (isSharing) return "default";
    return "outline";
  };

  const getButtonClass = () => {
    if (isSharing) {
      return "bg-green-100 hover:bg-green-200 border-green-300 text-green-800";
    }
    return "hover:bg-yellow-50 hover:border-yellow-300";
  };

  const tooltipText = isSharing
    ? "You're sharing your live location with group members. Click to stop."
    : hasPermission === false
      ? "Location access denied. Please enable location permissions in your browser settings."
      : "Share your live location with group members";

  return (
    <Button
      type="button"
      variant={getButtonVariant()}
      size="sm"
      onClick={handleToggle}
      disabled={disabled || isLoading || hasPermission === false}
      className={`${getButtonClass()} ${className}`}
      title={tooltipText}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isSharing ? (
        <MapPin className="w-4 h-4 text-green-600" />
      ) : (
        <MapPinOff className="w-4 h-4" />
      )}
    </Button>
  );
};
