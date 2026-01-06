"use client";

import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import { SkeletonQuickAttendance } from "@/components/ui/skeleton-cards";
import { useFestival } from "@/contexts/FestivalContext";
import { useTents } from "@/hooks/use-tents";
import { useConfetti } from "@/hooks/useConfetti";
import { apiClient } from "@/lib/api-client";
import { formatDateForDatabase } from "@/lib/date-utils";
import { useTranslation } from "@/lib/i18n/client";
import { quickAttendanceSchema } from "@/lib/schemas/attendance";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { QuickAttendanceFormData } from "@/lib/schemas/attendance";
import type { AttendanceByDate } from "@prostcounter/shared/schemas";

interface QuickAttendanceRegistrationFormProps {
  onAttendanceIdReceived: (attendanceId: string) => void;
}

// const LocationSharingStatus = ({
//   isSharing,
//   hasGroupSharingEnabled,
// }: {
//   isSharing: boolean;
//   hasGroupSharingEnabled: boolean;
// }) => {
//   const getStatusMessage = () => {
//     if (isSharing && !hasGroupSharingEnabled) {
//       return "Location tracking active, but no groups are enabled to see your location. Configure sharing in your profile settings.";
//     }
//     if (isSharing && hasGroupSharingEnabled) {
//       return null;
//     }
//     return null;
//   };

//   const message = getStatusMessage();
//   if (!message) return null;

//   return (
//     <div className="text-center mt-2">
//       <p className="text-sm text-muted-foreground">{message}</p>
//     </div>
//   );
// };

export const QuickAttendanceRegistrationForm = ({
  onAttendanceIdReceived,
}: QuickAttendanceRegistrationFormProps) => {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const {
    tents,
    isLoading: tentsLoading,
    error: tentsError,
  } = useTents(currentFestival?.id);
  const { isExploding, triggerConfetti } = useConfetti();
  const [attendanceData, setAttendanceData] = useState<AttendanceByDate | null>(
    null,
  );

  // Location sharing hooks
  // const {
  //   startLocationSharing,
  //   stopLocationSharing,
  //   isUpdatingLocation,
  //   isStoppingSharing,
  //   isSharing,
  // } = useLocationSharing(currentFestival?.id);

  // const { data: preferences } = useLocationSharingPreferences(
  //   currentFestival?.id,
  // );
  // const hasGroupSharingEnabled = useMemo(() => {
  //   return preferences?.some((pref) => pref.sharing_enabled) ?? false;
  // }, [preferences]);

  // const isActuallySharing = isSharing && hasGroupSharingEnabled;

  // const handleToggle = async () => {
  //   if (isUpdatingLocation || isStoppingSharing || !currentFestival) return;

  //   try {
  //     if (!isActuallySharing) {
  //       // Request location permission and start sharing
  //       if (!navigator.geolocation) {
  //         toast.error("Geolocation is not supported by this browser");
  //         return;
  //       }

  //       await startLocationSharing();

  //       // Show appropriate message based on group sharing status
  //       if (hasGroupSharingEnabled) {
  //         toast.success(
  //           "Location sharing enabled! Group members can now see your location.",
  //         );
  //       } else {
  //         toast.success(
  //           "Location tracking started! Enable location sharing for specific groups in your profile settings.",
  //         );
  //       }
  //     } else {
  //       // Stop sharing
  //       await stopLocationSharing();
  //       toast.success("Location sharing disabled.");
  //     }
  //   } catch (error) {
  //     if (error instanceof GeolocationPositionError) {
  //       switch (error.code) {
  //         case error.PERMISSION_DENIED:
  //           toast.error(
  //             "Location access denied. Please enable location permissions in your browser settings.",
  //           );
  //           break;
  //         case error.POSITION_UNAVAILABLE:
  //           toast.error("Location information is unavailable.");
  //           break;
  //         case error.TIMEOUT:
  //           toast.error("Location request timed out. Please try again.");
  //           break;
  //       }
  //     } else {
  //       const errorMessage =
  //         error instanceof Error
  //           ? error.message
  //           : "Failed to toggle location sharing. Please try again.";

  //       // Handle specific API errors
  //       if (
  //         errorMessage.includes("Location sharing not enabled for any groups")
  //       ) {
  //         toast.error(
  //           "Location sharing is not enabled for any groups. Please enable location sharing for at least one group in your profile settings first.",
  //         );
  //       } else {
  //         toast.error(errorMessage);
  //       }
  //     }
  //   }
  // };

  const {
    setValue,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<QuickAttendanceFormData>({
    resolver: zodResolver(quickAttendanceSchema),
    defaultValues: {
      tentId: "",
      beerCount: 0,
    },
  });

  const tentId = watch("tentId");
  const beerCount = watch("beerCount");

  useEffect(() => {
    const loadAttendance = async () => {
      if (!currentFestival || !currentFestival.id) {
        return;
      }

      try {
        const dateString = formatDateForDatabase(new Date());
        const { attendance } = await apiClient.attendance.getByDate({
          festivalId: currentFestival.id,
          date: dateString,
        });
        if (attendance) {
          setAttendanceData(attendance);
          onAttendanceIdReceived(attendance.id);
          setValue(
            "tentId",
            attendance.tentIds[attendance.tentIds.length - 1] || "",
          );
          setValue("beerCount", attendance.beerCount || 0);
        }
      } catch {
        toast.error(t("notifications.error.attendanceLoadFailed"));
      }
    };

    loadAttendance();
  }, [onAttendanceIdReceived, currentFestival, setValue, t]);

  const onSubmit = async (data: QuickAttendanceFormData) => {
    if (!currentFestival) {
      toast.error(t("notifications.error.noFestivalSelected"));
      return;
    }

    try {
      const previousBeerCount = attendanceData?.beerCount ?? 0;

      // Only send the new tent ID if it's different from the last one and not empty
      // This prevents duplicate tent visits in the database
      const tentsToSend =
        data.tentId && // Only if tent is selected (not empty)
        (!attendanceData?.tentIds ||
          attendanceData.tentIds.length === 0 ||
          attendanceData.tentIds[attendanceData.tentIds.length - 1] !==
            data.tentId)
          ? [data.tentId] // Only the new tent
          : []; // No new tent to add

      const dateString = formatDateForDatabase(new Date());
      const { attendanceId: newAttendanceId } =
        await apiClient.attendance.create({
          festivalId: currentFestival.id,
          date: dateString,
          tents: tentsToSend,
          amount: data.beerCount,
        });

      // Trigger confetti only if beer count increased
      if (data.beerCount > previousBeerCount) {
        triggerConfetti();
      }

      // Update the local state with the new tent ID if it was added
      const updatedTentIds =
        tentsToSend.length > 0
          ? [...(attendanceData?.tentIds ?? []), ...tentsToSend]
          : (attendanceData?.tentIds ?? []);

      const updatedAttendance: AttendanceByDate = {
        ...attendanceData!,
        id: newAttendanceId,
        beerCount: data.beerCount,
        tentIds: updatedTentIds,
      };
      setAttendanceData(updatedAttendance);
      onAttendanceIdReceived(newAttendanceId);

      // Update the tent selection to show the current tent (last tent in the array)
      if (updatedTentIds.length > 0) {
        const currentTentId = updatedTentIds[updatedTentIds.length - 1];
        setValue("tentId", currentTentId);
      }

      toast.success(t("notifications.success.attendanceUpdated"));
    } catch {
      toast.error(t("notifications.error.attendanceUpdateFailed"));
    }
  };

  if (tentsLoading || festivalLoading || !currentFestival) {
    return <SkeletonQuickAttendance />;
  }

  if (tentsError) {
    return <div>Error: {tentsError}</div>;
  }

  return (
    <>
      {isExploding && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <ConfettiExplosion
            force={0.4}
            duration={2200}
            particleCount={30}
            width={400}
          />
        </div>
      )}
      <form className="flex flex-col items-center gap-4">
        <p className="text-sm font-semibold">
          {tentId ? "You are at:" : "Are you there today?"}
        </p>
        <div className="flex items-center gap-2 w-full justify-center">
          <SingleSelect
            value={tentId}
            className="flex-1 max-w-64"
            buttonClassName="self-center"
            options={tents.map((tent) => ({
              title: tent.category,
              options: tent.options,
            }))}
            placeholder="Select your current tent"
            onSelect={(option) => {
              setValue("tentId", option.value);
              handleSubmit(onSubmit)();
            }}
            disabled={isSubmitting}
          />
          {/* Location sharing toggle disabled - requires migration from deprecated tables
              to session-based model. See: app/api/location-sharing/ for details */}
        </div>
        {/* Location sharing status disabled - pending database migration */}
        <div className="flex items-center">
          <Button
            type="button"
            variant="yellow"
            onClick={() => {
              setValue("beerCount", Math.max(0, beerCount - 1));
              handleSubmit(onSubmit)();
            }}
            disabled={isSubmitting}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="mx-2">{beerCount} 🍺 drank today</span>
          <Button
            type="button"
            variant="yellow"
            onClick={() => {
              setValue("beerCount", beerCount + 1);
              handleSubmit(onSubmit)();
            }}
            disabled={isSubmitting}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </>
  );
};
