import {
  useAddAdminFestivalTent,
  useAddAllAdminFestivalTents,
  useAdminAvailableTents,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Plus, Tent, X } from "lucide-react-native";
import { useCallback, useState } from "react";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { parsePriceInput } from "@/lib/admin/tent-price";
import { IconColors } from "@/lib/constants/colors";

interface AddTentsSheetProps {
  festivalId: string;
  isOpen: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}

/**
 * Picks catalogue tents this festival does not serve yet.
 *
 * Rows stay on screen after being added -- the underlying query refetches and
 * drops them -- so adding several in a row does not require reopening.
 */
export function AddTentsSheet({ festivalId, isOpen, onClose, onError }: AddTentsSheetProps) {
  const { t } = useTranslation();

  // Only fetched while open, so the detail screen's first load stays cheap.
  const { tents, isLoading } = useAdminAvailableTents(festivalId, isOpen);
  const addTent = useAddAdminFestivalTent();
  const addAllTents = useAddAllAdminFestivalTents();

  const [allPrice, setAllPrice] = useState("");

  const handleAdd = useCallback(
    async (tentId: string) => {
      try {
        await addTent.mutate({ festivalId, data: { tent_id: tentId } });
      } catch {
        onError(t("admin.mobile.festivalTents.addError"));
      }
    },
    [festivalId, addTent, onError, t],
  );

  const handleAddAll = useCallback(async () => {
    const parsed = parsePriceInput(allPrice);
    if (parsed === "invalid") {
      onError(t("admin.mobile.festivalTents.priceInvalid"));
      return;
    }

    try {
      await addAllTents.mutate({ festivalId, data: { beer_price: parsed } });
      onClose();
    } catch {
      onError(t("admin.mobile.festivalTents.addError"));
    }
  }, [allPrice, festivalId, addAllTents, onClose, onError, t]);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <HStack className="mb-4 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">
            {t("admin.mobile.festivalTents.addTents")}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t("common.buttons.close")}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="px-2 pb-4">
            {isLoading && (
              <Text className="text-typography-500">
                {t("admin.mobile.festivalTents.loadingAvailable")}
              </Text>
            )}

            {!isLoading && tents.length === 0 && (
              <VStack space="xs" className="items-center py-6">
                <Tent size={32} color={IconColors.muted} />
                <Text className="text-typography-500">
                  {t("admin.mobile.festivalTents.noneAvailable")}
                </Text>
              </VStack>
            )}

            {tents.length > 0 && (
              <Card size="sm" variant="outline">
                <VStack space="sm">
                  <Text className="text-typography-900">
                    {t("admin.mobile.festivalTents.addAll", { count: tents.length })}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.festivalTents.addAllHint")}
                  </Text>
                  <Input>
                    <InputField
                      value={allPrice}
                      onChangeText={setAllPrice}
                      keyboardType="decimal-pad"
                      placeholder={t("admin.mobile.festivalTents.pricePlaceholder")}
                      accessibilityLabel={t("admin.mobile.festivalTents.priceLabel")}
                    />
                  </Input>
                  <Button
                    isDisabled={addAllTents.loading}
                    onPress={handleAddAll}
                    accessibilityLabel={t("admin.mobile.festivalTents.addAll", {
                      count: tents.length,
                    })}
                  >
                    {addAllTents.loading && <ButtonSpinner />}
                    <ButtonText>{t("admin.mobile.festivalTents.addAllAction")}</ButtonText>
                  </Button>
                </VStack>
              </Card>
            )}

            {tents.map((tent) => (
              <Pressable
                key={tent.id}
                onPress={() => handleAdd(tent.id)}
                accessibilityRole="button"
                accessibilityLabel={tent.name}
                accessibilityHint={t("admin.mobile.festivalTents.addOneHint")}
              >
                <Card size="sm" variant="elevated">
                  <HStack className="items-center justify-between">
                    <VStack className="flex-1">
                      <Text className="text-typography-900">{tent.name}</Text>
                      <Text className="text-sm text-typography-500">
                        {tent.category ?? t("admin.mobile.tents.uncategorized")}
                      </Text>
                    </VStack>
                    <Plus size={20} color={IconColors.primary} />
                  </HStack>
                </Card>
              </Pressable>
            ))}
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
