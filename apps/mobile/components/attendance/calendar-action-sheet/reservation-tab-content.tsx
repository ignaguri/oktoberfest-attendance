import { useTranslation } from "@prostcounter/shared/i18n";
import type { Reservation } from "@prostcounter/shared/schemas";
import { format, parseISO } from "date-fns";

import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface ReservationTabContentProps {
  existingReservation: Reservation;
  onClose: () => void;
}

/** One label/value pair in the summary. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <VStack space="xs">
      <Text className="text-xs font-medium uppercase text-typography-500">{label}</Text>
      <Text className="text-base text-typography-900">{value}</Text>
    </VStack>
  );
}

/**
 * Read-only summary of a reservation on a day that has already passed.
 *
 * Creating, editing and cancelling reservations moved into the day planner,
 * which treats a plan and a reservation as one status per day. What is left is
 * reading a past reservation back: editing something that happened is
 * meaningless.
 */
export function ReservationTabContent({
  existingReservation,
  onClose,
}: ReservationTabContentProps) {
  const { t } = useTranslation();

  return (
    <VStack space="lg" className="px-2 pb-4">
      <VStack space="xs" className="rounded-lg bg-background-100 p-3">
        <Text className="text-sm font-medium text-typography-900">
          {t("reservation.past.title")}
        </Text>
        <Text className="text-sm text-typography-500">{t("reservation.past.description")}</Text>
      </VStack>

      <DetailRow
        label={t("reservation.form.tent")}
        value={existingReservation.tentName || t("reservation.checkIn.unknownTent")}
      />
      <DetailRow
        label={t("reservation.form.arrivalTime")}
        value={format(parseISO(existingReservation.startAt), "HH:mm")}
      />
      {existingReservation.note ? (
        <DetailRow label={t("reservation.checkIn.note")} value={existingReservation.note} />
      ) : null}

      <Button variant="outline" action="secondary" className="w-full" onPress={onClose}>
        <ButtonText>{t("common.buttons.close")}</ButtonText>
      </Button>
    </VStack>
  );
}

ReservationTabContent.displayName = "ReservationTabContent";
