"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ReservationForm,
  ReservationFormSchema,
} from "@prostcounter/shared/schemas";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import { ReminderSelect } from "@/components/ui/reminder-select";
import { useTents } from "@/hooks/use-tents";
import {
  useCreateReservation,
  useReservation,
  useUpdateReservation,
} from "@/hooks/useReservations";
import { useTranslation } from "@/lib/i18n/client";
import { createUrlWithParams } from "@/lib/url-utils";

import { Checkbox } from "../ui/checkbox";

interface ReservationDialogProps {
  festivalId: string;
}

export function ReservationDialog({ festivalId }: ReservationDialogProps) {
  const { t } = useTranslation();
  const { tents, isLoading: tentsLoading } = useTents(festivalId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const open =
    searchParams.get("newReservation") === "1" ||
    !!searchParams.get("reservationId");
  const reservationId = searchParams.get("reservationId");

  // Use React Query for fetching reservation data
  const { data: reservation, loading: reservationLoading } =
    useReservation(reservationId);

  // Mutations for create/update
  const { mutateAsync: createReservation, loading: isCreating } =
    useCreateReservation();
  const { mutateAsync: updateReservation, loading: isUpdating } =
    useUpdateReservation();

  const isMutating = isCreating || isUpdating;

  const initialDate = useMemo(() => {
    const dateStr = searchParams.get("date");
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [searchParams]);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReservationForm>({
    resolver: zodResolver(ReservationFormSchema),
    defaultValues: {
      tentId: "",
      startAt: undefined,
      reminderOffsetMinutes: 1440,
      visibleToGroups: true,
    },
  });

  const tentId = watch("tentId");
  const startAt = watch("startAt");
  const reminderOffsetMinutes = watch("reminderOffsetMinutes");
  const visibleToGroups = watch("visibleToGroups");

  // Initialize form when dialog opens or reservation data loads
  useEffect(() => {
    if (!open) return;

    if (reservationId && reservation) {
      // Editing existing reservation - populate form with fetched data
      reset({
        tentId: reservation.tentId,
        visibleToGroups: reservation.visibleToGroups,
        reminderOffsetMinutes: reservation.reminderOffsetMinutes ?? 1440,
        startAt: new Date(reservation.startAt),
      });
    } else if (!reservationId) {
      // Creating new reservation - set defaults
      const defaultDate = new Date(initialDate);
      defaultDate.setHours(9, 0, 0, 0);
      const defaultTentId =
        tents.length > 0 ? tents[0]?.options[0]?.value || "" : "";
      reset({
        tentId: defaultTentId,
        startAt: defaultDate,
        reminderOffsetMinutes: 1440,
        visibleToGroups: true,
      });
    }
  }, [open, initialDate, reservationId, reservation, reset, tents]);

  const onClose = useCallback(() => {
    const url = createUrlWithParams("/calendar", searchParams, [
      "newReservation",
      "reservationId",
    ]);
    router.replace(url);
  }, [router, searchParams]);

  const onSubmit = useCallback(
    async (data: ReservationForm) => {
      try {
        if (reservationId) {
          await updateReservation({
            reservationId,
            data: {
              startAt: data.startAt.toISOString(),
              reminderOffsetMinutes: data.reminderOffsetMinutes,
              visibleToGroups: data.visibleToGroups,
            },
          });
          toast.success(t("notifications.success.reservationUpdated"));
        } else {
          await createReservation({
            festivalId,
            tentId: data.tentId,
            startAt: data.startAt.toISOString(),
            reminderOffsetMinutes: data.reminderOffsetMinutes,
            visibleToGroups: data.visibleToGroups,
          });
          toast.success(t("notifications.success.reservationCreated"));
        }
        onClose();
      } catch {
        toast.error(t("notifications.error.reservationSaveFailed"));
      }
    },
    [
      festivalId,
      onClose,
      reservationId,
      createReservation,
      updateReservation,
      t,
    ],
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      title={
        reservationId
          ? t("reservation.dialog.editTitle")
          : t("reservation.dialog.createTitle")
      }
      description={t("reservation.dialog.description")}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 p-4 pb-6">
          <div className="grid gap-2">
            <Label htmlFor="tent">{t("reservation.dialog.tent")}</Label>
            <SingleSelect
              value={tentId}
              options={tents.map((tent) => ({
                title: tent.category,
                options: tent.options,
              }))}
              placeholder={t("reservation.dialog.selectTent")}
              onSelect={(option) => setValue("tentId", option.value)}
              disabled={tentsLoading || isMutating}
            />
            {errors.tentId && (
              <p className="text-sm text-red-600">{errors.tentId.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="start">{t("reservation.dialog.dateTime")}</Label>
            <DateTimePicker
              value={startAt}
              onChange={(date) => date && setValue("startAt", date)}
              placeholder={t("reservation.dialog.pickDateTime")}
              disabled={isMutating}
              calendarClassName="[--cell-size:--spacing(11)] md:[--cell-size:--spacing(12)]"
            />
            {errors.startAt && (
              <p className="text-sm text-red-600">{errors.startAt.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reminder">{t("reservation.dialog.reminder")}</Label>
            <ReminderSelect
              value={reminderOffsetMinutes}
              onChange={(minutes) => setValue("reminderOffsetMinutes", minutes)}
              disabled={isMutating}
            />
            {errors.reminderOffsetMinutes && (
              <p className="text-sm text-red-600">
                {errors.reminderOffsetMinutes.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="visibleToGroups">
              {t("reservation.dialog.shareWithGroups")}
            </Label>
            <Checkbox
              checked={visibleToGroups}
              onCheckedChange={(checked) =>
                setValue(
                  "visibleToGroups",
                  checked === "indeterminate" ? false : checked,
                )
              }
              disabled={isMutating}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isMutating}
          >
            {t("reservation.dialog.cancel")}
          </Button>
          <Button type="submit" disabled={isMutating || tentsLoading}>
            {reservationId
              ? t("reservation.dialog.save")
              : t("reservation.dialog.create")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
