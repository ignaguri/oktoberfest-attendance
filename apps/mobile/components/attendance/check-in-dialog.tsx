import { useTents } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { Reservation } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { format, parseISO } from "date-fns";
import { CalendarClock, Clock, MapPin, StickyNote } from "lucide-react-native";
import { useCallback, useMemo } from "react";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

interface CheckInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  festivalId: string;
  onCheckIn: () => void;
  isLoading?: boolean;
}

/**
 * Check-in confirmation dialog for reservations
 *
 * Shows reservation details and allows user to check in or dismiss.
 * Displayed when user taps a reservation reminder notification.
 */
export function CheckInDialog({
  isOpen,
  onClose,
  reservation,
  festivalId,
  onCheckIn,
  isLoading = false,
}: CheckInDialogProps) {
  const { t } = useTranslation();
  const { tents } = useTents(festivalId);

  // Get tent name
  const tentName = useMemo(() => {
    if (!reservation || !tents.length) return null;
    const allOptions = tents.flatMap((group) => group.options);
    const option = allOptions.find((opt) => opt.value === reservation.tentId);
    return option?.label || null;
  }, [reservation, tents]);

  // Format reservation time
  const formattedTime = useMemo(() => {
    if (!reservation) return "";
    return format(parseISO(reservation.startAt), "HH:mm");
  }, [reservation]);

  // Format reservation date
  const formattedDate = useMemo(() => {
    if (!reservation) return "";
    return formatLocalized(parseISO(reservation.startAt), "EEEE, MMMM d");
  }, [reservation]);

  const handleCheckIn = useCallback(() => {
    onCheckIn();
  }, [onCheckIn]);

  if (!reservation) return null;

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent>
        <AlertDialogHeader>
          <HStack space="sm" className="items-center">
            <CalendarClock size={24} color={Colors.primary[500]} />
            <Heading size="lg" className="text-typography-900">
              {t("reservation.checkIn.title")}
            </Heading>
          </HStack>
        </AlertDialogHeader>

        <AlertDialogBody className="mb-4 mt-3">
          <VStack space="md">
            <Text className="text-typography-600">
              {t("reservation.checkIn.description")}
            </Text>

            {/* Reservation Details */}
            <VStack
              space="sm"
              className="rounded-lg border border-background-200 bg-background-50 p-3"
            >
              {/* Tent */}
              {tentName && (
                <HStack space="sm" className="items-center">
                  <MapPin size={16} color={IconColors.muted} />
                  <Text className="font-medium text-typography-800">
                    {tentName}
                  </Text>
                </HStack>
              )}

              {/* Date & Time */}
              <HStack space="sm" className="items-center">
                <Clock size={16} color={IconColors.muted} />
                <Text className="text-typography-600">
                  {formattedDate} at {formattedTime}
                </Text>
              </HStack>

              {/* Note */}
              {reservation.note && (
                <HStack space="sm" className="items-start">
                  <StickyNote size={16} color={IconColors.muted} />
                  <Text className="flex-1 text-sm text-typography-500">
                    {reservation.note}
                  </Text>
                </HStack>
              )}
            </VStack>
          </VStack>
        </AlertDialogBody>

        <AlertDialogFooter className="gap-3">
          <Button
            variant="outline"
            action="secondary"
            onPress={onClose}
            className="flex-1"
            isDisabled={isLoading}
          >
            <ButtonText>{t("reservation.checkIn.notNow")}</ButtonText>
          </Button>
          <Button
            action="primary"
            onPress={handleCheckIn}
            className="flex-1"
            isDisabled={isLoading}
          >
            {isLoading ? (
              <ButtonSpinner color={Colors.white} />
            ) : (
              <ButtonText>{t("reservation.checkIn.checkInNow")}</ButtonText>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

CheckInDialog.displayName = "CheckInDialog";
