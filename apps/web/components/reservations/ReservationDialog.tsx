"use client";

import {
  createReservation,
  getReservationForEdit,
  updateReservation,
} from "@/app/(private)/calendar/actions";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import { ReminderSelect } from "@/components/ui/reminder-select";
import { useTents } from "@/hooks/use-tents";
import {
  reservationSchema,
  type ReservationFormData,
} from "@/lib/schemas/reservation";
import { createUrlWithParams } from "@/lib/url-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Checkbox } from "../ui/checkbox";

interface ReservationDialogProps {
  festivalId: string;
}

export function ReservationDialog({ festivalId }: ReservationDialogProps) {
  const { tents, isLoading: tentsLoading } = useTents();
  const searchParams = useSearchParams();
  const router = useRouter();
  const open =
    searchParams.get("newReservation") === "1" ||
    !!searchParams.get("reservationId");
  const reservationId = searchParams.get("reservationId");

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
    formState: { isSubmitting, errors },
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
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

  useEffect(() => {
    if (!open) return; // Don't initialize if dialog is not open

    // Initialize form data
    const init = async () => {
      if (reservationId) {
        try {
          const r = await getReservationForEdit(reservationId);
          // Reset form with the reservation data
          reset({
            tentId: r.tent_id,
            visibleToGroups: r.visible_to_groups,
            reminderOffsetMinutes: r.reminder_offset_minutes ?? 1440,
            startAt: new Date(r.start_at),
          });
          return;
        } catch {
          toast.error("Error", {
            description: "Failed to load reservation data",
          });
        }
      }
      // Set default time to 09:00 (9 AM) for the selected date for new reservations
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
    };
    init();
  }, [open, initialDate, reservationId, reset, tents]);

  const onClose = useCallback(() => {
    const url = createUrlWithParams("/calendar", searchParams, [
      "newReservation",
      "reservationId",
    ]);
    router.replace(url);
  }, [router, searchParams]);

  const onSubmit = useCallback(
    async (data: ReservationFormData) => {
      try {
        if (reservationId) {
          await updateReservation(reservationId, {
            startAt: data.startAt,
            reminderOffsetMinutes: data.reminderOffsetMinutes,
            visibleToGroups: data.visibleToGroups,
            tentId: data.tentId,
          });
          toast.success("Reservation updated");
        } else {
          await createReservation({
            festivalId,
            tentId: data.tentId,
            startAt: data.startAt,
            reminderOffsetMinutes: data.reminderOffsetMinutes,
            visibleToGroups: data.visibleToGroups,
          });
          toast.success("Reservation created");
        }
        onClose();
      } catch {
        toast.error("Failed to save reservation");
      }
    },
    [festivalId, onClose, reservationId],
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      title={reservationId ? "Edit reservation" : "New reservation"}
      description="Create or edit your tent reservation with date, time, and reminder preferences."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 p-4 pb-6">
          <div className="grid gap-2">
            <Label htmlFor="tent">Tent</Label>
            <SingleSelect
              value={tentId}
              options={tents.map((tent) => ({
                title: tent.category,
                options: tent.options,
              }))}
              placeholder="Select your tent"
              onSelect={(option) => setValue("tentId", option.value)}
              disabled={tentsLoading || isSubmitting}
            />
            {errors.tentId && (
              <p className="text-sm text-red-600">{errors.tentId.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="start">Date & Time</Label>
            <DateTimePicker
              value={startAt}
              onChange={(date) => date && setValue("startAt", date)}
              placeholder="Pick a date and time"
              disabled={isSubmitting}
              calendarClassName="[--cell-size:--spacing(11)] md:[--cell-size:--spacing(12)]"
            />
            {errors.startAt && (
              <p className="text-sm text-red-600">{errors.startAt.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reminder">Reminder</Label>
            <ReminderSelect
              value={reminderOffsetMinutes}
              onChange={(minutes) => setValue("reminderOffsetMinutes", minutes)}
              disabled={isSubmitting}
            />
            {errors.reminderOffsetMinutes && (
              <p className="text-sm text-red-600">
                {errors.reminderOffsetMinutes.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="visibleToGroups">Share with groups</Label>
            <Checkbox
              checked={visibleToGroups}
              onCheckedChange={(checked) =>
                setValue(
                  "visibleToGroups",
                  checked === "indeterminate" ? false : checked,
                )
              }
              disabled={isSubmitting}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || tentsLoading}>
            {reservationId ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
