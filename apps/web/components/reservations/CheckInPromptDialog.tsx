"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfetti } from "@/hooks/useConfetti";
import { useTranslation } from "@/lib/i18n/client";
import { createUrlWithParams } from "@/lib/url-utils";
import { MapPin, Clock, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { toast } from "sonner";

interface Reservation {
  id: string;
  tent: {
    name: string;
  } | null;
  start_at: string;
  visible_to_groups: boolean;
  note: string | null;
}

interface CheckInPromptDialogProps {
  reservation: Reservation | null;
  onCheckIn: (reservationId: string) => Promise<void>;
}

export function CheckInPromptDialog({
  reservation,
  onCheckIn,
}: CheckInPromptDialogProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isExploding, triggerConfetti } = useConfetti();
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const open = searchParams.get("prompt") === "checkin" && !!reservation;

  const handleClose = useCallback(() => {
    const url = createUrlWithParams("/attendance", searchParams, [
      "prompt",
      "reservationId",
    ]);
    router.replace(url);
  }, [searchParams, router]);

  const handleCheckIn = useCallback(async () => {
    if (!reservation) return;

    setIsCheckingIn(true);
    try {
      await onCheckIn(reservation.id);
      triggerConfetti();
      toast.success(t("notifications.success.checkedIn"), {
        description: t("notifications.descriptions.checkedIn"),
      });
      handleClose();
    } catch {
      toast.error(t("notifications.error.checkInFailed"), {
        description: t("reservation.checkIn.failedDescription"),
      });
    } finally {
      setIsCheckingIn(false);
    }
  }, [reservation, onCheckIn, handleClose, triggerConfetti, t]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-yellow-600" />
            {t("reservation.checkIn.prompt")}
          </DialogTitle>
          <DialogDescription>
            {t("reservation.checkIn.timeForReservation", {
              tentName:
                reservation.tent?.name || t("reservation.checkIn.theTent"),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reservation Details */}
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="font-medium">
                  {reservation.tent?.name ||
                    t("reservation.checkIn.unknownTent")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{formatTime(reservation.start_at)}</span>
              </div>
              {reservation.visible_to_groups && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>{t("reservation.dialog.visibleToGroups")}</span>
                </div>
              )}
              {reservation.note && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">
                    {t("reservation.checkIn.note")}:
                  </span>{" "}
                  {reservation.note}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isCheckingIn}
              className="flex-1"
            >
              {t("reservation.checkIn.notYet")}
            </Button>
            <Button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700"
            >
              {isCheckingIn
                ? t("reservation.checkIn.checking")
                : t("reservation.checkIn.checkInNow")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
