"use client";

import { DrinkStepper } from "@/components/attendance/drink-stepper";
import { DrinkTypePicker } from "@/components/attendance/drink-type-picker";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { SkeletonQuickAttendance } from "@/components/ui/skeleton-cards";
import { useFestival } from "@/contexts/FestivalContext";
import { useTents } from "@/hooks/use-tents";
import { useConfetti } from "@/hooks/useConfetti";
import { apiClient } from "@/lib/api-client";
import { formatDateForDatabase } from "@/lib/date-utils";
import { useTranslation } from "@/lib/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConsumptions } from "@prostcounter/shared/hooks";
import { QuickAttendanceFormSchema } from "@prostcounter/shared/schemas";
import { useEffect, useState, useMemo } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type {
  QuickAttendanceForm,
  AttendanceByDate,
  DrinkType,
} from "@prostcounter/shared/schemas";

interface QuickAttendanceRegistrationFormProps {
  onAttendanceIdReceived: (attendanceId: string) => void;
}

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
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>("beer");

  // Get today's date string
  const todayString = useMemo(() => formatDateForDatabase(new Date()), []);

  // Fetch consumptions for today
  const { data: consumptionsData } = useConsumptions(
    currentFestival?.id || "",
    todayString,
  );
  const consumptions = consumptionsData || [];

  // Calculate drink count summary
  const drinkSummary = useMemo(() => {
    const counts: Record<DrinkType, number> = {
      beer: 0,
      radler: 0,
      wine: 0,
      soft_drink: 0,
      alcohol_free: 0,
      other: 0,
    };
    for (const c of consumptions) {
      if (counts[c.drinkType] !== undefined) {
        counts[c.drinkType]++;
      }
    }
    return {
      counts,
      total: consumptions.length,
    };
  }, [consumptions]);

  const {
    setValue,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<QuickAttendanceForm>({
    resolver: zodResolver(QuickAttendanceFormSchema),
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

  const onSubmit = async (data: QuickAttendanceForm) => {
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
        <div className="pointer-events-none fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
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
        <div className="flex w-full items-center justify-center gap-2">
          <SingleSelect
            value={tentId}
            className="max-w-64 flex-1"
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
        {/* Drink Type Selector + Stepper (vertical centered layout) */}
        {currentFestival && (
          <div className="flex flex-col items-center gap-4">
            <DrinkTypePicker
              selectedType={selectedDrinkType}
              onSelect={setSelectedDrinkType}
              counts={drinkSummary.counts}
              disabled={isSubmitting}
            />
            <DrinkStepper
              festivalId={currentFestival.id}
              date={todayString}
              drinkType={selectedDrinkType}
              tentId={tentId || undefined}
              consumptions={consumptions}
              disabled={isSubmitting}
              onSuccess={triggerConfetti}
            />
          </div>
        )}
      </form>
    </>
  );
};
