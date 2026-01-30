"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFestival } from "@prostcounter/shared/contexts";
import { useConsumptions } from "@prostcounter/shared/hooks";
import type {
  AttendanceByDate,
  DrinkType,
  QuickAttendanceForm,
} from "@prostcounter/shared/schemas";
import { QuickAttendanceFormSchema } from "@prostcounter/shared/schemas";
import { useEffect, useMemo, useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DrinkStepper } from "@/components/attendance/drink-stepper";
import { DrinkTypePicker } from "@/components/attendance/drink-type-picker";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { SkeletonQuickAttendance } from "@/components/ui/skeleton-cards";
import { useTents } from "@/hooks/use-tents";
import { useConfetti } from "@/hooks/useConfetti";
import { apiClient } from "@/lib/api-client";
import { formatDateForDatabase } from "@/lib/date-utils";
import { useTranslation } from "@/lib/i18n/client";

interface QuickAttendanceRegistrationFormProps {
  onAttendanceIdReceived: (attendanceId: string) => void;
  attendanceId: string | null;
  renderPhotoUpload?: (attendanceId: string | null) => React.ReactNode;
}

export const QuickAttendanceRegistrationForm = ({
  onAttendanceIdReceived,
  attendanceId,
  renderPhotoUpload,
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
      {/* Card containing all attendance controls - matching mobile layout */}
      {currentFestival && (
        <form className="flex w-full flex-col gap-4 rounded-lg border bg-white p-4">
          {/* Header with title and count summary */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {t("home.quickAttendance.title")}
            </h3>
            {drinkSummary.total > 0 && (
              <span className="text-muted-foreground text-sm">
                {t("home.quickAttendance.drinksToday", {
                  count: drinkSummary.total,
                })}
              </span>
            )}
          </div>

          {/* Drink Type Selector */}
          <DrinkTypePicker
            selectedType={selectedDrinkType}
            onSelect={setSelectedDrinkType}
            counts={drinkSummary.counts}
            disabled={isSubmitting}
            hideSelectedLabel
          />

          {/* Stepper (underneath drink types like mobile) */}
          <div className="flex flex-col items-center gap-1">
            <DrinkStepper
              festivalId={currentFestival.id}
              date={todayString}
              drinkType={selectedDrinkType}
              tentId={tentId || undefined}
              consumptions={consumptions}
              disabled={isSubmitting}
              onSuccess={triggerConfetti}
            />
            <span className="text-muted-foreground text-xs">
              {t(`attendance.drinkTypes.${selectedDrinkType}`, {
                count: drinkSummary.counts[selectedDrinkType] || 0,
              })}
            </span>
          </div>

          {/* Tent selector section */}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-sm font-medium">
              {t("home.quickAttendance.tent")}
            </span>
            <SingleSelect
              value={tentId}
              className="w-full"
              options={tents.map((tent) => ({
                title: tent.category,
                options: tent.options,
              }))}
              placeholder={t("home.quickAttendance.selectTent")}
              onSelect={(option) => {
                setValue("tentId", option.value);
                handleSubmit(onSubmit)();
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Photo upload section */}
          {renderPhotoUpload && (
            <div className="flex flex-col">
              <span className="text-muted-foreground mb-1 text-sm font-medium">
                {t("home.quickAttendance.photos")}
              </span>
              {renderPhotoUpload(attendanceId)}
            </div>
          )}
        </form>
      )}
    </>
  );
};
