"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createUrlWithParams } from "@/lib/url-utils";
import { MapPin, Clock, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
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
      toast({
        variant: "success",
        title: "Checked in!",
        description: "Your attendance has been logged successfully.",
      });
      handleClose();
    } catch {
      toast({
        variant: "destructive",
        title: "Check-in failed",
        description: "Failed to check in. Please try again.",
      });
    } finally {
      setIsCheckingIn(false);
    }
  }, [reservation, onCheckIn, toast, handleClose]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-yellow-600" />
            Are you there yet?
          </DialogTitle>
          <DialogDescription>
            It&apos;s time for your reservation at{" "}
            {reservation.tent?.name || "the tent"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reservation Details */}
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="font-medium">
                  {reservation.tent?.name || "Unknown Tent"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{formatTime(reservation.start_at)}</span>
              </div>
              {reservation.visible_to_groups && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>Visible to your groups</span>
                </div>
              )}
              {reservation.note && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Note:</span> {reservation.note}
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
              Not yet
            </Button>
            <Button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700"
            >
              {isCheckingIn ? "Checking in..." : "Check in now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
