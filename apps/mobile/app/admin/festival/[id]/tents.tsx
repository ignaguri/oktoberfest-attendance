import {
  useAdminFestivalTents,
  useRemoveAdminFestivalTent,
  useSetAdminFestivalTentPrice,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useLocalSearchParams } from "expo-router";
import { Copy, Plus, Tent, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl } from "react-native";

import { AddTentsSheet } from "@/components/admin/add-tents-sheet";
import { CopyTentsSheet } from "@/components/admin/copy-tents-sheet";
import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { formatPriceInput, parsePriceInput } from "@/lib/admin/tent-price";
import { IconColors } from "@/lib/constants/colors";

/**
 * Which tents this festival serves, and what a beer costs in each.
 *
 * The catalogue itself lives at /admin/tents -- this screen only assigns from
 * it and prices what it assigns.
 */
export default function AdminFestivalTentsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { tents, stats, isLoading, error, refetch, isRefetching } = useAdminFestivalTents(id);
  const setPrice = useSetAdminFestivalTentPrice();
  const removeTent = useRemoveAdminFestivalTent();

  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  // Seeded on tap rather than in an effect, so a background refetch cannot
  // overwrite a price being typed.
  const [editing, setEditing] = useState<{ tentId: string; value: string } | null>(null);

  const showError = useCallback(
    (message: string) => showDialog(t("common.status.error"), message),
    [showDialog, t],
  );

  const handleSavePrice = useCallback(async () => {
    if (!editing) return;

    const parsed = parsePriceInput(editing.value);
    if (parsed === "invalid") {
      showError(t("admin.mobile.festivalTents.priceInvalid"));
      return;
    }

    try {
      await setPrice.mutate({ festivalId: id, tentId: editing.tentId, beerPrice: parsed });
      setEditing(null);
    } catch {
      showError(t("admin.mobile.festivalTents.priceError"));
    }
  }, [editing, id, setPrice, showError, t]);

  const handleRemove = useCallback(
    (tentId: string, tentName: string) => {
      showDialog(
        t("admin.mobile.festivalTents.remove"),
        t("admin.mobile.festivalTents.removeConfirm", { name: tentName }),
        "destructive",
        async () => {
          try {
            await removeTent.mutate({ festivalId: id, tentId });
          } catch (err) {
            // A 409 carries the server's reason (people have visited it); show
            // that rather than a generic failure.
            const message =
              err instanceof Error && err.message
                ? err.message
                : t("admin.mobile.festivalTents.removeError");
            showError(message);
          }
        },
      );
    },
    [id, removeTent, showDialog, showError, t],
  );

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background-50"
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={isRefetching ?? false} onRefresh={refetch} />}
      >
        <VStack space="md">
          {stats && stats.total_tents > 0 && (
            <Card size="md" variant="elevated">
              <HStack className="justify-between">
                <VStack className="flex-1 items-center">
                  <Text className="text-lg font-semibold text-typography-900">
                    {stats.total_tents}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.festivalTents.statTents")}
                  </Text>
                </VStack>
                <VStack className="flex-1 items-center">
                  <Text className="text-lg font-semibold text-typography-900">
                    {stats.with_custom_pricing}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.festivalTents.statPriced")}
                  </Text>
                </VStack>
                <VStack className="flex-1 items-center">
                  <Text className="text-lg font-semibold text-typography-900">
                    {stats.avg_price === null ? "—" : `€${stats.avg_price.toFixed(2)}`}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.festivalTents.statAverage")}
                  </Text>
                </VStack>
              </HStack>
            </Card>
          )}

          <HStack space="sm">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => setAddOpen(true)}
              accessibilityLabel={t("admin.mobile.festivalTents.addTents")}
              accessibilityHint={t("admin.mobile.festivalTents.addTentsHint")}
            >
              <Plus size={16} color={IconColors.primary} />
              <ButtonText>{t("admin.mobile.festivalTents.addTents")}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="secondary"
              className="flex-1"
              onPress={() => setCopyOpen(true)}
              accessibilityLabel={t("admin.mobile.festivalTents.copyFrom")}
              accessibilityHint={t("admin.mobile.festivalTents.copyFromHint")}
            >
              <Copy size={16} color={IconColors.default} />
              <ButtonText>{t("admin.mobile.festivalTents.copyAction")}</ButtonText>
            </Button>
          </HStack>

          {isLoading && (
            <Text className="text-typography-500">{t("admin.mobile.festivalTents.loading")}</Text>
          )}

          {!isLoading && tents.length === 0 && (
            <Card size="md" variant="elevated">
              <VStack space="xs" className="items-center py-6">
                <Tent size={32} color={IconColors.muted} />
                <Text className="text-typography-500">{t("admin.mobile.festivalTents.empty")}</Text>
              </VStack>
            </Card>
          )}

          {tents.map((tent) => (
            <Card key={tent.festival_tent_id} size="md" variant="elevated">
              <VStack space="sm">
                <HStack className="items-center justify-between">
                  <VStack className="flex-1 pr-3">
                    <Text className="font-semibold text-typography-900">{tent.name}</Text>
                    <Text className="text-sm text-typography-500">
                      {tent.category ?? t("admin.mobile.tents.uncategorized")}
                    </Text>
                  </VStack>
                  <Pressable
                    onPress={() => handleRemove(tent.tent_id, tent.name)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("admin.mobile.festivalTents.remove")}
                    accessibilityHint={t("admin.mobile.festivalTents.removeHint")}
                  >
                    <Trash2 size={18} color={IconColors.error} />
                  </Pressable>
                </HStack>

                {editing?.tentId === tent.tent_id ? (
                  <VStack space="sm">
                    <Input>
                      <InputField
                        value={editing.value}
                        onChangeText={(value) => setEditing({ ...editing, value })}
                        keyboardType="decimal-pad"
                        placeholder={t("admin.mobile.festivalTents.pricePlaceholder")}
                        accessibilityLabel={t("admin.mobile.festivalTents.priceLabel")}
                      />
                    </Input>
                    <Text className="text-sm text-typography-400">
                      {t("admin.mobile.festivalTents.priceClearHint")}
                    </Text>
                    <HStack space="sm">
                      <Button
                        variant="outline"
                        action="secondary"
                        className="flex-1"
                        onPress={() => setEditing(null)}
                        accessibilityLabel={t("common.buttons.cancel")}
                      >
                        <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                      </Button>
                      <Button
                        className="flex-1"
                        isDisabled={setPrice.loading}
                        onPress={handleSavePrice}
                        accessibilityLabel={t("common.buttons.save")}
                      >
                        {setPrice.loading && <ButtonSpinner />}
                        <ButtonText>{t("common.buttons.save")}</ButtonText>
                      </Button>
                    </HStack>
                  </VStack>
                ) : (
                  <Pressable
                    onPress={() =>
                      setEditing({
                        tentId: tent.tent_id,
                        value: formatPriceInput(tent.beer_price),
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t("admin.mobile.festivalTents.priceLabel")}
                    accessibilityHint={t("admin.mobile.festivalTents.priceEditHint")}
                  >
                    <HStack className="items-center justify-between border-t border-outline-100 pt-2">
                      <Text className="text-sm text-typography-500">
                        {t("admin.mobile.festivalTents.priceLabel")}
                      </Text>
                      <Text className="text-typography-900">
                        {tent.beer_price === null
                          ? t("admin.mobile.festivalTents.noPrice")
                          : `€${tent.beer_price.toFixed(2)}`}
                      </Text>
                    </HStack>
                  </Pressable>
                )}
              </VStack>
            </Card>
          ))}

          <View className="h-4" />
        </VStack>
      </ScrollView>

      <AddTentsSheet
        festivalId={id}
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onError={showError}
      />

      <CopyTentsSheet
        festivalId={id}
        isOpen={copyOpen}
        onClose={() => setCopyOpen(false)}
        onError={showError}
        onCopied={(count) =>
          showDialog(
            t("admin.mobile.festivalTents.copyFrom"),
            t("admin.mobile.festivalTents.copyResult", { count }),
          )
        }
      />

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
