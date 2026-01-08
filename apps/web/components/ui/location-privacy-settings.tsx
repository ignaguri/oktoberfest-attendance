"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useFestival } from "@/contexts/FestivalContext";
import { useUserGroups } from "@/hooks/useGroups";
import {
  useLocationSharingPreferences,
  useUpdateLocationSharingPreferences,
} from "@/hooks/useLocationSharing";
import { useInvalidateQueries } from "@/lib/data/react-query-provider";
import { getFestivalConstants } from "@/lib/festivalConstants";
import { QueryKeys } from "@prostcounter/shared/data";
import { MapPin, Users, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export const LocationPrivacySettings = () => {
  const { currentFestival } = useFestival();
  const { data: preferences, loading: preferencesLoading } =
    useLocationSharingPreferences(currentFestival?.id);
  const updatePreferences = useUpdateLocationSharingPreferences();
  const invalidateQueries = useInvalidateQueries();

  const festivalName = currentFestival
    ? getFestivalConstants(currentFestival).festivalName
    : "Current Festival";

  // Fetch all user's groups using the existing hook
  const { data: groups } = useUserGroups(currentFestival?.id);

  const groupsWithPreferences = useMemo(() => {
    if (!groups) return [];

    return groups.map((group: { id: string; name: string }) => {
      const preference = preferences?.find((p) => p.group_id === group.id);
      return {
        groupId: group.id,
        groupName: group.name,
        sharingEnabled: preference?.sharing_enabled || false,
      };
    });
  }, [groups, preferences]);

  const handleToggleSharing = async (groupId: string, enabled: boolean) => {
    if (!currentFestival?.id) {
      toast.error("Festival not selected");
      return;
    }

    try {
      await updatePreferences.mutateAsync({
        groupId,
        festivalId: currentFestival.id,
        sharingEnabled: enabled,
      });

      // Manually invalidate the cache to ensure UI updates immediately
      invalidateQueries(
        QueryKeys.locationSharingPreferences(currentFestival.id),
      );
    } catch (error) {
      // Error handling is already done in the mutation
      console.error("Failed to toggle location sharing:", error);
    }
  };

  if (preferencesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Sharing Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Sharing Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Control which groups can see your live location during{" "}
            {festivalName}. You can enable or disable location sharing for each
            group independently.
          </p>

          {groupsWithPreferences.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-sm">
                You&apos;re not a member of any groups yet.
                <br />
                Join a group to control your location sharing preferences.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupsWithPreferences.map(
                (group: {
                  groupId: string;
                  groupName: string;
                  sharingEnabled: boolean;
                }) => (
                  <div
                    key={group.groupId}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Label className="font-medium">{group.groupName}</Label>
                        <Badge
                          variant={
                            group.sharingEnabled ? "success" : "secondary"
                          }
                          className="text-xs"
                        >
                          {group.sharingEnabled ? "Sharing" : "Not Sharing"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-left text-xs">
                        {group.sharingEnabled
                          ? "Group members can see your live location"
                          : "Group members cannot see your location"}
                      </p>
                    </div>

                    <Button
                      variant={group.sharingEnabled ? "destructive" : "default"}
                      size="sm"
                      onClick={() =>
                        handleToggleSharing(
                          group.groupId,
                          !group.sharingEnabled,
                        )
                      }
                      disabled={updatePreferences.loading}
                    >
                      {updatePreferences.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : group.sharingEnabled ? (
                        "Disable"
                      ) : (
                        "Enable"
                      )}
                    </Button>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="mt-4 rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Location sharing only works when
              you&apos;re actively sharing your location using the toggle
              button. Even if enabled here, group members will only see your
              location when you&apos;re sharing it.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
