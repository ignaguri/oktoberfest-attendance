import type {
  LocationSession,
  LocationSessionMember,
  NearbyTent,
} from "@prostcounter/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";
import * as Location from "expo-location";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { apiClient } from "@/lib/api-client";
import {
  clearLocationSessionId,
  getStoredLocationSessionId,
  hasLocationPromptBeenShown,
  type LocationPermissionStatus,
  setLocationPromptShown,
  storeLocationSessionId,
} from "@/lib/auth/secure-storage";
import { supabase } from "@/lib/supabase";

import {
  type BackgroundLocationData,
  isBackgroundLocationRunning,
  setBackgroundLocationCallback,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from "./background-location";
import { useLocation } from "./useLocation";

/**
 * Location Context Type
 */
interface LocationContextType {
  // Permission state
  permissionStatus: LocationPermissionStatus;
  isPermissionLoading: boolean;
  hasPromptBeenShown: boolean;
  hasPermission: boolean;
  hasBackgroundPermission: boolean;

  // Session state
  activeSession: LocationSession | null;
  isSharing: boolean;
  isSessionLoading: boolean;

  // Location state
  currentLocation: Location.LocationObject | null;
  isLocationLoading: boolean;
  isLocalTrackingActive: boolean;

  // Nearby data (live via Supabase Realtime)
  nearbyMembers: LocationSessionMember[];
  nearbyTents: NearbyTent[];
  closestTent: NearbyTent | null;
  isNearbyLoading: boolean;

  // Actions
  requestPermission: () => Promise<boolean>;
  requestBackgroundPermission: () => Promise<boolean>;
  markPromptAsShown: () => Promise<void>;
  startSharing: (
    festivalId: string,
    durationMinutes?: number,
  ) => Promise<boolean>;
  stopSharing: () => Promise<boolean>;
  startLocalTracking: (festivalId?: string) => Promise<boolean>;
  stopLocalTracking: () => void;
  refreshNearby: (
    festivalId?: string,
    locationOverride?: Location.LocationObject,
  ) => Promise<void>;
  clearLocationState: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

/**
 * Location Provider
 *
 * Manages location permissions, sharing sessions, and nearby data.
 * Uses Supabase Realtime for live friend location updates.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();

  // Prompt state
  const [hasPromptBeenShown, setHasPromptBeenShown] = useState(false);

  // Session state
  const [activeSession, setActiveSession] = useState<LocationSession | null>(
    null,
  );
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // Nearby state
  const [nearbyMembers, setNearbyMembers] = useState<LocationSessionMember[]>(
    [],
  );
  const [nearbyTents, setNearbyTents] = useState<NearbyTent[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState(false);

  // Local tracking state (for map view without sharing)
  const [isLocalTrackingActive, setIsLocalTrackingActive] = useState(false);
  const localTrackingRef = useRef(false);

  // Realtime subscription
  const realtimeChannel = useRef<RealtimeChannel | null>(null);
  const locationWatchActive = useRef(false);

  /**
   * Load initial state
   */
  useEffect(() => {
    async function loadState() {
      try {
        const [promptShown, storedSessionId] = await Promise.all([
          hasLocationPromptBeenShown(),
          getStoredLocationSessionId(),
        ]);

        setHasPromptBeenShown(promptShown);

        // Check if we have an active session stored
        if (storedSessionId) {
          // Try to verify the session is still active
          const isRunning = await isBackgroundLocationRunning();
          if (!isRunning) {
            // Session expired or was stopped, clear it
            await clearLocationSessionId();
          }
        }
      } catch (error) {
        console.error("[LocationContext] Error loading state:", error);
      } finally {
        setIsSessionLoading(false);
      }
    }

    loadState();
  }, []);

  /**
   * Mark the permission prompt as shown
   */
  const markPromptAsShown = useCallback(async () => {
    await setLocationPromptShown(true);
    setHasPromptBeenShown(true);
  }, []);

  /**
   * Update location on the server
   */
  const updateLocationOnServer = useCallback(
    async (loc: Location.LocationObject) => {
      if (!activeSession) return;

      try {
        await apiClient.location.updateLocation(activeSession.id, {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? undefined,
          timestamp: new Date(loc.timestamp).toISOString(),
        });
      } catch (error) {
        console.error("[LocationContext] Error updating location:", error);
      }
    },
    [activeSession],
  );

  /**
   * Start location sharing
   */
  const startSharing = useCallback(
    async (festivalId: string, durationMinutes = 120): Promise<boolean> => {
      if (!location.hasPermission) {
        console.warn("[LocationContext] No permission to start sharing");
        return false;
      }

      try {
        setIsSessionLoading(true);

        // Get current location for initial position
        const currentLoc = await location.getCurrentLocation();

        // Start session via API
        const result = await apiClient.location.startSession({
          festivalId,
          durationMinutes,
          initialLocation: currentLoc
            ? {
                latitude: currentLoc.coords.latitude,
                longitude: currentLoc.coords.longitude,
                accuracy: currentLoc.coords.accuracy ?? undefined,
                timestamp: new Date(currentLoc.timestamp).toISOString(),
              }
            : undefined,
        });

        if (!result?.session) {
          console.error("[LocationContext] Error starting session");
          return false;
        }

        const session = result.session;
        setActiveSession(session);
        await storeLocationSessionId(session.id);

        // Get user info from Supabase for background task
        const { data: userData } = await supabase.auth.getUser();

        // Start background location updates
        if (location.hasBackgroundPermission && userData?.user) {
          const backgroundData: BackgroundLocationData = {
            sessionId: session.id,
            userId: userData.user.id,
            festivalId,
          };

          // Set the callback for background updates
          // Validate stored session to avoid stale closure references
          setBackgroundLocationCallback(async (loc, bgData) => {
            const storedSessionId = await getStoredLocationSessionId();
            if (!storedSessionId || storedSessionId !== bgData.sessionId) {
              return;
            }
            try {
              await apiClient.location.updateLocation(storedSessionId, {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracy: loc.coords.accuracy ?? undefined,
                timestamp: new Date(loc.timestamp).toISOString(),
              });
            } catch (err) {
              console.error("[LocationContext] Background update error:", err);
            }
          });

          await startBackgroundLocationUpdates(backgroundData);
        }

        // Start foreground watching as well
        locationWatchActive.current = true;
        await location.startWatching(
          (loc) => {
            updateLocationOnServer(loc);
          },
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50,
            timeInterval: 30000,
          },
        );

        return true;
      } catch (error) {
        // Differentiate error types for better debugging
        if (error instanceof Error) {
          if (
            error.message.includes("permission") ||
            error.message.includes("Location")
          ) {
            console.error(
              "[LocationContext] Permission error starting sharing:",
              error.message,
            );
          } else if (
            error.message.includes("network") ||
            error.message.includes("fetch") ||
            error.message.includes("timeout")
          ) {
            console.error(
              "[LocationContext] Network error starting sharing:",
              error.message,
            );
          } else {
            console.error(
              "[LocationContext] API error starting sharing:",
              error.message,
            );
          }
        } else {
          console.error(
            "[LocationContext] Unknown error starting sharing:",
            error,
          );
        }
        return false;
      } finally {
        setIsSessionLoading(false);
      }
    },
    [location, updateLocationOnServer],
  );

  /**
   * Stop location sharing
   */
  const stopSharing = useCallback(async (): Promise<boolean> => {
    try {
      setIsSessionLoading(true);

      // Stop background updates
      await stopBackgroundLocationUpdates();
      setBackgroundLocationCallback(null);

      // Stop foreground watching
      location.stopWatching();
      locationWatchActive.current = false;

      // Stop session via API
      if (activeSession) {
        await apiClient.location.stopSession(activeSession.id);
      }

      // Clear local state
      setActiveSession(null);
      await clearLocationSessionId();

      return true;
    } catch (error) {
      console.error("[LocationContext] Error stopping sharing:", error);
      return false;
    } finally {
      setIsSessionLoading(false);
    }
  }, [activeSession, location]);

  /**
   * Refresh nearby members and tents
   * @param festivalId - Optional festival ID for tent queries when not sharing
   * @param locationOverride - Optional location to use instead of currentLocation (for when state hasn't updated yet)
   */
  const refreshNearby = useCallback(
    async (festivalId?: string, locationOverride?: Location.LocationObject) => {
      const loc = locationOverride || location.currentLocation;
      if (!loc) return;

      // Determine which festival to use
      const targetFestivalId = festivalId || activeSession?.festivalId;
      if (!targetFestivalId) return;

      setIsNearbyLoading(true);

      try {
        // Always fetch nearby tents if we have location
        const tentsPromise = apiClient.tents.getNearby({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          radiusMeters: 500, // 500m for tents
          festivalId: targetFestivalId,
        });

        // Only fetch nearby members if we have an active session (sharing)
        const membersPromise = activeSession
          ? apiClient.location.getNearbyMembers({
              festivalId: activeSession.festivalId,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              radiusMeters: 1000, // 1km radius
            })
          : Promise.resolve(null);

        const [tentsResult, membersResult] = await Promise.all([
          tentsPromise,
          membersPromise,
        ]);

        if (tentsResult?.tents) {
          setNearbyTents(tentsResult.tents);
        }

        if (membersResult?.members) {
          setNearbyMembers(membersResult.members);
        } else if (!activeSession) {
          // Clear members when not sharing
          setNearbyMembers([]);
        }
      } catch (error) {
        console.error("[LocationContext] Error refreshing nearby:", error);
      } finally {
        setIsNearbyLoading(false);
      }
    },
    [location.currentLocation, activeSession],
  );

  /**
   * Start local tracking (for map view without sharing)
   * Only watches location locally, doesn't upload to server
   * @param festivalId - Optional festival ID to fetch nearby tents immediately
   */
  const startLocalTracking = useCallback(
    async (festivalId?: string): Promise<boolean> => {
      // Don't start if already sharing (sharing handles its own tracking)
      if (activeSession || localTrackingRef.current) {
        return true;
      }

      // Request permission if we don't have it
      if (!location.hasPermission) {
        const granted = await location.requestForegroundPermission();
        if (!granted) {
          return false;
        }
      }

      try {
        localTrackingRef.current = true;
        setIsLocalTrackingActive(true);

        // Get current location first (for immediate display)
        const currentLoc = await location.getCurrentLocation();

        // Start watching location for updates (locally only, no server upload)
        await location.startWatching(
          () => {
            // No-op callback - we just want to update currentLocation in useLocation
          },
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 20,
            timeInterval: 10000,
          },
        );

        // Fetch nearby tents immediately if we have location and festivalId
        // Pass location directly via locationOverride to bypass stale state
        if (currentLoc && festivalId) {
          refreshNearby(festivalId, currentLoc);
        }

        return true;
      } catch (error) {
        console.error(
          "[LocationContext] Error starting local tracking:",
          error,
        );
        localTrackingRef.current = false;
        setIsLocalTrackingActive(false);
        return false;
      }
    },
    [activeSession, location, refreshNearby],
  );

  /**
   * Stop local tracking
   */
  const stopLocalTracking = useCallback(() => {
    // Don't stop if we're sharing (sharing manages its own tracking)
    if (activeSession) {
      return;
    }

    if (localTrackingRef.current) {
      location.stopWatching();
      localTrackingRef.current = false;
      setIsLocalTrackingActive(false);
    }
  }, [activeSession, location]);

  /**
   * Set up Supabase Realtime subscription for live friend updates
   */
  useEffect(() => {
    if (!activeSession || nearbyMembers.length === 0) {
      // Clean up existing subscription
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
      return;
    }

    // Get session IDs of nearby friends (limit to closest 20 to avoid
    // hitting URL length or Supabase filter limits)
    const friendSessionIds = nearbyMembers
      .slice(0, 20)
      .map((m) => m.sessionId)
      .filter((id): id is string => !!id);

    if (friendSessionIds.length === 0) return;

    // Subscribe to location_points changes for friends
    const channel = supabase
      .channel("friend-locations")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "location_points",
          filter: `session_id=in.(${friendSessionIds.join(",")})`,
        },
        (payload) => {
          // Update friend's location in state
          const newPoint = payload.new as {
            session_id: string;
            latitude: number;
            longitude: number;
            accuracy: number | null;
            recorded_at: string;
          };

          setNearbyMembers((prev) =>
            prev.map((m) =>
              m.sessionId === newPoint.session_id
                ? {
                    ...m,
                    lastLocation: {
                      latitude: newPoint.latitude,
                      longitude: newPoint.longitude,
                      accuracy: newPoint.accuracy ?? undefined,
                      timestamp: newPoint.recorded_at,
                    },
                  }
                : m,
            ),
          );
        },
      )
      .subscribe();

    realtimeChannel.current = channel;

    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
    };
  }, [activeSession, nearbyMembers]);

  /**
   * Periodically refresh nearby data when sharing
   */
  useEffect(() => {
    if (!activeSession || !location.currentLocation) return;

    // Initial refresh
    refreshNearby();

    // Refresh every 30 seconds
    const interval = setInterval(refreshNearby, 30000);

    return () => clearInterval(interval);
  }, [activeSession, location.currentLocation, refreshNearby]);

  /**
   * Clear all location state
   */
  const clearLocationState = useCallback(async () => {
    await stopSharing();
    setNearbyMembers([]);
    setNearbyTents([]);
  }, [stopSharing]);

  /**
   * Cleanup on unmount: stop sharing, subscriptions, and tracking
   */
  useEffect(() => {
    return () => {
      // Clean up realtime subscription
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
      // Stop foreground watching
      if (locationWatchActive.current) {
        location.stopWatching();
        locationWatchActive.current = false;
      }
      // Stop local tracking
      if (localTrackingRef.current) {
        location.stopWatching();
        localTrackingRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate closest tent
  const closestTent = nearbyTents.length > 0 ? nearbyTents[0] : null; // Already sorted by distance from API

  const value: LocationContextType = {
    // Permission state
    permissionStatus: location.permissionStatus,
    isPermissionLoading: location.isPermissionLoading,
    hasPromptBeenShown,
    hasPermission: location.hasPermission,
    hasBackgroundPermission: location.hasBackgroundPermission,

    // Session state
    activeSession,
    isSharing: !!activeSession,
    isSessionLoading,

    // Location state
    currentLocation: location.currentLocation,
    isLocationLoading: location.isLocationLoading,
    isLocalTrackingActive,

    // Nearby data
    nearbyMembers,
    nearbyTents,
    closestTent,
    isNearbyLoading,

    // Actions
    requestPermission: location.requestForegroundPermission,
    requestBackgroundPermission: location.requestBackgroundPermission,
    markPromptAsShown,
    startSharing,
    stopSharing,
    startLocalTracking,
    stopLocalTracking,
    refreshNearby,
    clearLocationState,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Hook to access location context
 */
export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error(
      "useLocationContext must be used within a LocationProvider",
    );
  }
  return context;
}

/**
 * Default context for use outside LocationProvider
 */
const defaultContext: LocationContextType = {
  permissionStatus: "undetermined",
  isPermissionLoading: true,
  hasPromptBeenShown: false,
  hasPermission: false,
  hasBackgroundPermission: false,
  activeSession: null,
  isSharing: false,
  isSessionLoading: true,
  currentLocation: null,
  isLocationLoading: false,
  isLocalTrackingActive: false,
  nearbyMembers: [],
  nearbyTents: [],
  closestTent: null,
  isNearbyLoading: false,
  requestPermission: async () => false,
  requestBackgroundPermission: async () => false,
  markPromptAsShown: async () => {},
  startSharing: async () => false,
  stopSharing: async () => false,
  startLocalTracking: async () => false,
  stopLocalTracking: () => {},
  refreshNearby: async () => {},
  clearLocationState: async () => {},
};

/**
 * Safe hook that returns default values when outside provider
 */
export function useLocationContextSafe() {
  const context = useContext(LocationContext);
  return context ?? defaultContext;
}
