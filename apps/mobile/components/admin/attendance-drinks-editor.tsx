import {
  useAddAdminConsumption,
  useDeleteAdminConsumption,
  useUpdateAdminConsumption,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { Consumption, DrinkType } from "@prostcounter/shared/schemas";
import { Plus, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";

import { DrinkTypePicker } from "@/components/attendance/drink-type-picker";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface AttendanceDrinksEditorProps {
  attendanceId: string;
  consumptions: Consumption[];
  isLoading: boolean;
  onError: (message: string) => void;
}

/**
 * A day's logged drinks: retype one by tapping it, remove it, or add one.
 * Each change is its own request and saves right away, independent of the
 * sheet's Save button.
 */
export function AttendanceDrinksEditor({
  attendanceId,
  consumptions,
  isLoading,
  onError,
}: AttendanceDrinksEditorProps) {
  const { t } = useTranslation();
  const addConsumption = useAddAdminConsumption();
  const updateConsumption = useUpdateAdminConsumption();
  const deleteConsumption = useDeleteAdminConsumption();

  const [retypingId, setRetypingId] = useState<string | null>(null);
  const [newType, setNewType] = useState<DrinkType>("beer");

  const handleRetype = useCallback(
    async (consumption: Consumption, drinkType: DrinkType) => {
      setRetypingId(null);
      if (drinkType === consumption.drinkType) {
        return;
      }
      try {
        await updateConsumption.mutate({
          consumptionId: consumption.id,
          data: { drink_type: drinkType },
        });
      } catch {
        onError(t("admin.mobile.userDetail.edit.drinkError"));
      }
    },
    [onError, t, updateConsumption],
  );

  const handleRemove = useCallback(
    async (consumptionId: string) => {
      try {
        await deleteConsumption.mutate(consumptionId);
      } catch {
        onError(t("admin.mobile.userDetail.edit.drinkError"));
      }
    },
    [deleteConsumption, onError, t],
  );

  const handleAdd = useCallback(async () => {
    try {
      await addConsumption.mutate({ attendanceId, data: { drink_type: newType } });
    } catch {
      onError(t("admin.mobile.userDetail.edit.drinkError"));
    }
  }, [addConsumption, attendanceId, newType, onError, t]);

  return (
    <VStack space="sm">
      <Text className="text-sm font-medium text-typography-700">
        {t("admin.mobile.userDetail.edit.drinks")}
      </Text>
      <Text className="text-sm text-typography-500">
        {t("admin.mobile.userDetail.edit.drinksHint")}
      </Text>

      {isLoading && (
        <Text className="text-typography-500">
          {t("admin.mobile.userDetail.edit.drinksLoading")}
        </Text>
      )}

      {consumptions.map((consumption) => {
        const label = t(`attendance.drinkTypes.${consumption.drinkType}`);
        const retyping = retypingId === consumption.id;

        return (
          <Card key={consumption.id} size="sm" variant="outline">
            <VStack space="sm">
              <HStack className="items-center justify-between">
                <Pressable
                  className="flex-1"
                  onPress={() => setRetypingId(retyping ? null : consumption.id)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint={t("admin.mobile.userDetail.edit.changeDrinkHint")}
                >
                  <HStack space="sm" className="items-center">
                    <Text className="text-typography-900">{label}</Text>
                    <Text className="text-typography-500">
                      {`€${(consumption.pricePaidCents / 100).toFixed(2)}`}
                    </Text>
                  </HStack>
                </Pressable>
                <Pressable
                  onPress={() => handleRemove(consumption.id)}
                  disabled={deleteConsumption.loading}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("admin.mobile.userDetail.edit.removeDrink")}
                  accessibilityHint={t("admin.mobile.userDetail.edit.removeDrinkHint")}
                >
                  <Trash2 size={18} color={IconColors.error} />
                </Pressable>
              </HStack>

              {retyping && (
                <DrinkTypePicker
                  selectedType={consumption.drinkType}
                  onSelect={(drinkType) => handleRetype(consumption, drinkType)}
                  disabled={updateConsumption.loading}
                  compact
                />
              )}
            </VStack>
          </Card>
        );
      })}

      <VStack space="sm" className="items-start">
        <DrinkTypePicker selectedType={newType} onSelect={setNewType} compact />
        <Button
          size="sm"
          variant="outline"
          isDisabled={addConsumption.loading}
          onPress={handleAdd}
          accessibilityLabel={t("admin.mobile.userDetail.edit.addDrink")}
          accessibilityHint={t("admin.mobile.userDetail.edit.addDrinkHint")}
        >
          {addConsumption.loading ? <ButtonSpinner /> : <Plus size={16} color={IconColors.default} />}
          <ButtonText>{t("admin.mobile.userDetail.edit.addDrink")}</ButtonText>
        </Button>
      </VStack>
    </VStack>
  );
}
