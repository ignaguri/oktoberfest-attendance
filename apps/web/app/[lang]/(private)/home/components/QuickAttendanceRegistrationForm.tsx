"use client";

// Use standardSchemaResolver instead of zodResolver to avoid Turbopack build failures
// caused by @hookform/resolvers v5.x importing "zod/v4/core" which Turbopack cannot resolve.
// See: https://github.com/colinhacks/zod/issues/4879
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useFestival } from "@prostcounter/shared/contexts";
import { useConsumptions } from "@prostcounter/shared/hooks";
import type { DrinkType, QuickAttendanceForm } from "@prostcounter/shared/schemas";
import { QuickAttendanceFormSchema } from "@prostcounter/shared/schemas";
import { getCurrentTentId } from "@prostcounter/shared/utils";
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
  onTentSelected?: (tentId: string) => void;
  attendanceId: string | null;
  renderPhotoUpload?: (attendanceId: string | null) => React.ReactNode;
}

export const QuickAttendanceRegistrationForm = ({
  onAttendanceIdReceived,
  onTentSelected,
  attendanceId,
  renderPhotoUpload,
}: QuickAttendanceRegistrationFormProps) => {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const { tents, isLoading: tentsLoading, error: tentsError } = useTents(currentFestival?.id);
  const { isExploding, triggerConfetti } = useConfetti();
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>("beer");

  // Get today's date string
  const todayString = useMemo(() => formatDateForDatabase(new Date()), []);

  // Fetch consumptions for today
  const { data: consumptionsData } = useConsumptions(currentFestival?.id || "", todayString);
  const consumptions = useMemo(() => consumptionsData || [], [consumptionsData]);

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
    resolver: standardSchemaResolver(QuickAttendanceFormSchema),
    defaultValues: {
      tentId: "",
      beerCount: 0,
    },
  });

  const tentId = watch("tentId");

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
          onAttendanceIdReceived(attendance.id);
          // The tent the user is in is their latest visit. Not the end of
          // tentIds: that field is a set in first-visit order, so a day that
          // went A, then B, then back to A leaves B sitting at the end of it
          // while A is where the user actually is. This value feeds the drink
          // stepper below, so reading it wrong misfiles every drink logged.
          setValue("tentId", getCurrentTentId(attendance.tentVisits) ?? "");
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
      // Send whatever tent is selected and let the RPC decide whether it is a
      // move. add_or_update_attendance_with_tents already skips the insert when
      // the tent equals the day's most recent visit, and it compares against
      // the real latest visit rather than against a deduplicated set, so the
      // client second-guessing it here only ever got the answer wrong: on a day
      // that revisited a tent it read the wrong "current" tent and dropped the
      // move entirely.
      const tentsToSend = data.tentId ? [data.tentId] : [];

      const dateString = formatDateForDatabase(new Date());
      const { attendanceId: newAttendanceId } = await apiClient.attendance.create({
        festivalId: currentFestival.id,
        date: dateString,
        tents: tentsToSend,
        amount: 0,
      });

      onAttendanceIdReceived(newAttendanceId);

      // Refetch attendance to get the full object from the server
      const { attendance: freshAttendance } = await apiClient.attendance.getByDate({
        festivalId: currentFestival.id,
        date: dateString,
      });
      // Re-read the current tent from the visits the save just produced, so the
      // field agrees with what was stored.
      const currentTentId = getCurrentTentId(freshAttendance?.tentVisits ?? []);
      if (currentTentId) {
        setValue("tentId", currentTentId);
      }

      toast.success(t("notifications.success.attendanceUpdated"));

      // Prompt crowd report whenever a tent is selected (new or existing),
      // so users can always report the current conditions.
      if (data.tentId && onTentSelected) {
        onTentSelected(data.tentId);
      }
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
          <ConfettiExplosion force={0.4} duration={2200} particleCount={30} width={400} />
        </div>
      )}
      {/* Card containing all attendance controls - matching mobile layout */}
      {currentFestival && (
        <form className="flex w-full flex-col gap-4 rounded-lg border bg-white p-4">
          {/* Header with title and count summary */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("home.quickAttendance.title")}</h3>
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
