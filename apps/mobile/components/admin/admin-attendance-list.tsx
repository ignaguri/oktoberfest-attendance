import type { AdminAttendance } from "@prostcounter/shared/schemas";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Pencil, Trash2 } from "lucide-react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface AdminAttendanceListProps {
  attendances: AdminAttendance[];
  isLoading: boolean;
  onEdit: (attendance: AdminAttendance) => void;
  onDelete: (attendanceId: string) => void;
}

/**
 * A user's attendances, with an editor and a delete on each row.
 *
 * Each row carries its own festival_id, which is what the editor's tent picker
 * needs; there is no festival context to thread down from this screen.
 */
export function AdminAttendanceList({
  attendances,
  isLoading,
  onEdit,
  onDelete,
}: AdminAttendanceListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Text className="text-typography-500">{t("admin.mobile.userDetail.loading")}</Text>;
  }

  if (attendances.length === 0) {
    return (
      <Text className="text-typography-500">{t("admin.mobile.userDetail.noAttendances")}</Text>
    );
  }

  return (
    <VStack>
      {attendances.map((attendance, index) => (
        <View
          key={attendance.id}
          className={index < attendances.length - 1 ? "border-b border-outline-100 py-3" : "py-3"}
        >
          <HStack className="items-center justify-between">
            <VStack className="flex-1">
              <Text className="text-typography-900">{attendance.date}</Text>
              <Text className="text-sm text-typography-500">
                {t("admin.mobile.userDetail.attendanceSummary", {
                  beers: attendance.beer_count,
                  tents: attendance.tent_ids.length,
                })}
              </Text>
            </VStack>

            <HStack space="xs">
              <Button
                variant="outline"
                size="xs"
                onPress={() => onEdit(attendance)}
                accessibilityLabel={t("admin.mobile.userDetail.edit.open")}
                accessibilityHint={t("admin.mobile.userDetail.edit.openHint")}
              >
                <Pencil size={14} color={IconColors.primary} />
                <ButtonText>{t("admin.mobile.userDetail.edit.open")}</ButtonText>
              </Button>

              <Button
                variant="outline"
                action="negative"
                size="xs"
                onPress={() => onDelete(attendance.id)}
                accessibilityLabel={t("admin.mobile.userDetail.deleteAttendance")}
                accessibilityHint={t("admin.mobile.userDetail.deleteAttendanceHint")}
              >
                <Trash2 size={14} color={IconColors.error} />
                <ButtonText>{t("common.buttons.delete")}</ButtonText>
              </Button>
            </HStack>
          </HStack>
        </View>
      ))}
    </VStack>
  );
}
