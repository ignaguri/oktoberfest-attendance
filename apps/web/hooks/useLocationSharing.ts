/**
 * Business logic hooks for location sharing functionality
 */

import { QueryKeys } from "@prostcounter/shared/data";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useInvalidateQueries,
  useMutation,
  useQuery,
} from "@/lib/data/react-query-provider";

export interface LocationSharingPreference {
  id: string;
  user_id: string;
  group_id: string;
  festival_id: string;
  sharing_enabled: boolean;
  auto_enable_on_checkin: boolean;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
  groups: {
    id: string;
    name: string;
  };
}

export interface UserLocation {
  id: string;
  user_id: string;
  festival_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  altitude?: number;
  status: "active" | "paused" | "expired";
  last_updated: string;
  expires_at: string;
}

export interface NearbyGroupMember {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  last_updated: string;
  group_names: string[];
}

/**
 * Hook to fetch location sharing preferences for a festival
 */
export function useLocationSharingPreferences(festivalId?: string) {
  return useQuery(
    QueryKeys.locationSharingPreferences(festivalId || ""),
    async () => {
      const response = await fetch(
        `/api/location-sharing/preferences?festivalId=${festivalId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch location sharing preferences");
      }

      const data = await response.json();
      return data.preferences as LocationSharingPreference[];
    },
    {
      enabled: !!festivalId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  );
}

/**
 * Hook to update location sharing preferences
 */
export function useUpdateLocationSharingPreferences() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (preferences: {
      groupId: string;
      festivalId: string;
      sharingEnabled: boolean;
      autoEnableOnCheckin?: boolean;
      notificationEnabled?: boolean;
    }) => {
      const response = await fetch("/api/location-sharing/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update preferences");
      }

      return response.json();
    },
    {
      onSuccess: (_, variables) => {
        // Invalidate preferences cache for the specific festival
        invalidateQueries(
          QueryKeys.locationSharingPreferences(variables.festivalId),
        );
        toast.success(
          variables.sharingEnabled
            ? "Location sharing enabled"
            : "Location sharing disabled",
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    },
  );
}

/**
 * Hook to get nearby group members
 */
export function useNearbyGroupMembers(
  festivalId?: string,
  radiusMeters: number = 500,
) {
  return useQuery(
    QueryKeys.nearbyGroupMembers(festivalId || "", radiusMeters),
    async () => {
      const response = await fetch(
        `/api/location-sharing/location?festivalId=${festivalId}&radiusMeters=${radiusMeters}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch nearby group members");
      }

      const data = await response.json();
      return {
        nearbyMembers: data.nearbyMembers ?? [],
        activeSharing: data.activeSharing ?? false,
      };
    },
    {
      enabled: !!festivalId,
      staleTime: 30 * 1000, // 30 seconds - location data should be fresh
      gcTime: 2 * 60 * 1000, // 2 minutes cache
    },
  );
}

/**
 * Hook to manage live location sharing
 */
export function useLocationSharing(festivalId?: string) {
  const watchIdRef = useRef<number | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  // Check if user has active location sharing in the database
  const { data: activeLocationData } = useQuery(
    QueryKeys.activeLocation(festivalId || ""),
    async () => {
      if (!festivalId) return null;

      const response = await fetch(
        `/api/location-sharing/location?festivalId=${festivalId}&radiusMeters=1`,
      );

      if (!response.ok) {
        return null;
      }

      return response.json();
    },
    {
      enabled: !!festivalId,
      staleTime: 10 * 1000, // 10 seconds - check frequently
      gcTime: 30 * 1000, // 30 seconds cache
    },
  );

  const updateLocationMutation = useMutation(
    async (location: {
      festivalId: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
      altitude?: number;
    }) => {
      console.log("Updating location for festival:", location.festivalId);

      const response = await fetch("/api/location-sharing/location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(location),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Location update failed:", error);
        throw new Error(error.error || "Failed to update location");
      }

      return response.json();
    },
  );

  const stopSharingMutation = useMutation(async (festivalId: string) => {
    const response = await fetch(
      `/api/location-sharing/location?festivalId=${festivalId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to stop location sharing");
    }

    return response.json();
  });

  const startLocationSharing = useCallback(async () => {
    if (!festivalId || !navigator.geolocation) {
      throw new Error("Location services not available");
    }

    console.log("Starting location sharing for festival:", festivalId);

    return new Promise<void>((resolve, reject) => {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { coords } = position;

          console.log("Sending location update:", {
            festivalId,
            latitude: coords.latitude,
            longitude: coords.longitude,
          });

          updateLocationMutation.mutate({
            festivalId,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            heading: coords.heading || undefined,
            speed: coords.speed || undefined,
            altitude: coords.altitude || undefined,
          });

          // Resolve on first successful position
          if (watchIdRef.current === null) {
            watchIdRef.current = watchId;
            setIsWatching(true);
            resolve();
          }
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Use cached position if less than 1 minute old
        },
      );
    });
  }, [festivalId, updateLocationMutation]);

  const stopLocationSharing = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsWatching(false);
    }

    if (festivalId) {
      await stopSharingMutation.mutateAsync(festivalId);
    }
  }, [festivalId, stopSharingMutation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    startLocationSharing,
    stopLocationSharing,
    isUpdatingLocation: updateLocationMutation.loading,
    isStoppingSharing: stopSharingMutation.loading,
    updateError: updateLocationMutation.error,
    stopError: stopSharingMutation.error,
    isSharing: isWatching || activeLocationData?.activeSharing === true,
  };
}
