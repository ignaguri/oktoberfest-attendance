"use client";

import {
  createReservation,
  getReservationForEdit,
  updateReservation,
} from "@/app/(private)/calendar/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createDatetimeLocalString } from "@/lib/date-utils";
import { createUrlWithParams } from "@/lib/url-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface TentOption {
  id: string;
  name: string;
}

interface ReservationDialogProps {
  festivalId: string;
  tents: TentOption[];
}

export function ReservationDialog({
  festivalId,
  tents,
}: ReservationDialogProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
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

  const [tentId, setTentId] = useState<string>(tents[0]?.id ?? "");
  const [startAtLocal, setStartAtLocal] = useState<string>("");
  const [visibleToGroups, setVisibleToGroups] = useState(true);
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(1440);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Initialize datetime-local to the selected date at 18:00 local
    const init = async () => {
      if (reservationId) {
        try {
          const r = await getReservationForEdit(reservationId);
          setTentId(r.tent_id);
          setVisibleToGroups(r.visible_to_groups);
          setReminderOffsetMinutes(r.reminder_offset_minutes ?? 1440);
          const d = new Date(r.start_at);
          const iso = createDatetimeLocalString(d);
          setStartAtLocal(iso);
          return;
        } catch {}
      }
      const iso = createDatetimeLocalString(initialDate, 18, 0);
      setStartAtLocal(iso);
    };
    init();
  }, [initialDate, reservationId]);

  const onClose = useCallback(() => {
    const url = createUrlWithParams("", searchParams, [
      "newReservation",
      "reservationId",
    ]);
    router.replace(url);
  }, [router, searchParams]);

  const onSubmit = useCallback(async () => {
    if (!tentId || !startAtLocal) return;
    setSubmitting(true);
    try {
      if (reservationId) {
        await updateReservation(reservationId, {
          startAt: new Date(startAtLocal),
          reminderOffsetMinutes,
          visibleToGroups,
          tentId,
        });
        toast({ title: "Reservation updated" });
      } else {
        await createReservation({
          festivalId,
          tentId,
          startAt: new Date(startAtLocal),
          reminderOffsetMinutes,
          visibleToGroups,
        });
        toast({ title: "Reservation created" });
      }
      onClose();
    } catch (e) {
      toast({ title: "Failed to create reservation", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [
    festivalId,
    tentId,
    startAtLocal,
    reminderOffsetMinutes,
    visibleToGroups,
    onClose,
    toast,
    reservationId,
  ]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New reservation</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tent">Tent</Label>
            <Select value={tentId} onValueChange={(v) => setTentId(v)}>
              <option value="" disabled>
                Select tent
              </option>
              {tents.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              name="start"
              type="datetime-local"
              value={startAtLocal}
              onChange={(e) => setStartAtLocal(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reminder">Reminder (minutes before)</Label>
            <Input
              id="reminder"
              name="reminder"
              type="number"
              min={0}
              step={5}
              value={reminderOffsetMinutes}
              onChange={(e) => setReminderOffsetMinutes(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="visibleToGroups">Share with groups</Label>
            <input
              id="visibleToGroups"
              name="visibleToGroups"
              type="checkbox"
              checked={visibleToGroups}
              onChange={(e) => setVisibleToGroups(e.target.checked)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !tentId || !startAtLocal}
          >
            {reservationId ? "Save" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
