import {
  useAdminFestival,
  useDeleteAdminFestival,
  useUpdateAdminFestival,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronRight, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";

import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors, SwitchColors } from "@/lib/constants/colors";

const STATUSES = ["upcoming", "active", "ended"] as const;

export default function AdminFestivalDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { festival, isLoading, error, refetch } = useAdminFestival(id);
  const updateFestival = useUpdateAdminFestival();
  const deleteFestival = useDeleteAdminFestival();

  // Seeded on first edit rather than in an effect, so a background refetch
  // cannot overwrite in-progress typing.
  const [draft, setDraft] = useState<{ name: string; location: string } | null>(null);

  const startEditing = useCallback(() => {
    if (!festival) return;
    setDraft({ name: festival.name, location: festival.location });
  }, [festival]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    try {
      await updateFestival.mutate({
        festivalId: id,
        data: { name: draft.name.trim(), location: draft.location.trim() },
      });
      setDraft(null);
    } catch {
      showDialog(t("common.status.error"), t("admin.mobile.festivalDetail.updateError"));
    }
  }, [draft, id, updateFestival, showDialog, t]);

  const handleSetStatus = useCallback(
    async (status: (typeof STATUSES)[number]) => {
      try {
        await updateFestival.mutate({ festivalId: id, data: { status } });
      } catch {
        showDialog(t("common.status.error"), t("admin.mobile.festivalDetail.updateError"));
      }
    },
    [id, updateFestival, showDialog, t],
  );

  const handleToggleActive = useCallback(
    async (value: boolean) => {
      try {
        await updateFestival.mutate({ festivalId: id, data: { is_active: value } });
      } catch {
        showDialog(t("common.status.error"), t("admin.mobile.festivalDetail.updateError"));
      }
    },
    [id, updateFestival, showDialog, t],
  );

  const handleDelete = useCallback(() => {
    showDialog(
      t("admin.mobile.festivalDetail.deleteFestival"),
      t("admin.mobile.festivalDetail.deleteFestivalConfirm"),
      "destructive",
      async () => {
        try {
          await deleteFestival.mutate(id);
          router.back();
        } catch (err) {
          // A 409 carries the server's reason (attendances or groups still
          // reference it); show that rather than a generic failure.
          const message =
            err instanceof Error && err.message
              ? err.message
              : t("admin.mobile.festivalDetail.deleteError");
          showDialog(t("common.status.error"), message);
        }
      },
    );
  }, [id, deleteFestival, router, showDialog, t]);

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (isLoading || !festival) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Text className="text-typography-500">{t("admin.mobile.festivalDetail.loading")}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
        <VStack space="md">
          {/* Name and location */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              {draft ? (
                <>
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.festivalDetail.name")}
                  </Text>
                  <Input>
                    <InputField
                      value={draft.name}
                      onChangeText={(name) => setDraft({ ...draft, name })}
                      accessibilityLabel={t("admin.mobile.festivalDetail.name")}
                    />
                  </Input>

                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.festivalDetail.location")}
                  </Text>
                  <Input>
                    <InputField
                      value={draft.location}
                      onChangeText={(location) => setDraft({ ...draft, location })}
                      accessibilityLabel={t("admin.mobile.festivalDetail.location")}
                    />
                  </Input>

                  <HStack space="sm">
                    <Button
                      variant="outline"
                      action="secondary"
                      className="flex-1"
                      onPress={() => setDraft(null)}
                      accessibilityLabel={t("common.buttons.cancel")}
                    >
                      <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                    </Button>
                    <Button
                      className="flex-1"
                      isDisabled={
                        draft.name.trim().length === 0 ||
                        draft.location.trim().length === 0 ||
                        updateFestival.loading
                      }
                      onPress={handleSave}
                      accessibilityLabel={t("common.buttons.save")}
                    >
                      {updateFestival.loading && <ButtonSpinner />}
                      <ButtonText>{t("common.buttons.save")}</ButtonText>
                    </Button>
                  </HStack>
                </>
              ) : (
                <>
                  <Text className="text-lg font-semibold text-typography-900">{festival.name}</Text>
                  <Text className="text-sm text-typography-500">{festival.location}</Text>
                  <Text className="text-sm text-typography-400">
                    {festival.start_date} – {festival.end_date}
                  </Text>
                  <Button
                    variant="outline"
                    onPress={startEditing}
                    accessibilityLabel={t("admin.mobile.festivalDetail.edit")}
                  >
                    <ButtonText>{t("admin.mobile.festivalDetail.edit")}</ButtonText>
                  </Button>
                </>
              )}
            </VStack>
          </Card>

          {/* Active flag */}
          <Card size="md" variant="elevated">
            <HStack className="items-center justify-between">
              <VStack className="flex-1 pr-3">
                <Text className="text-typography-900">
                  {t("admin.mobile.festivalDetail.isActive")}
                </Text>
                <Text className="text-sm text-typography-500">
                  {t("admin.mobile.festivalDetail.isActiveHint")}
                </Text>
              </VStack>
              <Switch
                value={festival.is_active}
                onValueChange={handleToggleActive}
                isDisabled={updateFestival.loading}
                trackColor={{ false: SwitchColors.trackOff, true: SwitchColors.trackOn }}
                thumbColor={SwitchColors.thumb}
                accessibilityLabel={t("admin.mobile.festivalDetail.isActive")}
              />
            </HStack>
          </Card>

          {/* Status */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <Text className="text-typography-900">{t("admin.mobile.festivalDetail.status")}</Text>
              {STATUSES.map((status, index) => (
                <Pressable
                  key={status}
                  className={cn(
                    "flex-row items-center justify-between py-3",
                    index < STATUSES.length - 1 && "border-b border-outline-100",
                  )}
                  onPress={() => handleSetStatus(status)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`admin.mobile.festivals.status.${status}`)}
                  accessibilityState={{ selected: festival.status === status }}
                >
                  <Text className="text-typography-900">
                    {t(`admin.mobile.festivals.status.${status}`)}
                  </Text>
                  {festival.status === status && <Check size={20} color={IconColors.primary} />}
                </Pressable>
              ))}
            </VStack>
          </Card>

          {/* Tents */}
          <Pressable
            onPress={() => router.push(`/admin/festival/${id}/tents`)}
            accessibilityRole="button"
            accessibilityLabel={t("admin.mobile.festivalTents.title")}
            accessibilityHint={t("admin.mobile.festivalTents.openHint")}
          >
            <Card size="md" variant="elevated">
              <HStack className="items-center justify-between">
                <VStack className="flex-1 pr-3">
                  <Text className="text-typography-900">
                    {t("admin.mobile.festivalTents.title")}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.festivalTents.openHint")}
                  </Text>
                </VStack>
                <ChevronRight size={20} color={IconColors.muted} />
              </HStack>
            </Card>
          </Pressable>

          {/* Delete */}
          <Card size="md" variant="outline" className="border-error-300">
            <VStack space="sm">
              <Text className="text-error-700">{t("admin.mobile.festivalDetail.dangerZone")}</Text>
              <Text className="text-sm text-typography-500">
                {t("admin.mobile.festivalDetail.deleteBlockedHint")}
              </Text>
              <Button
                variant="outline"
                action="negative"
                isDisabled={deleteFestival.loading}
                onPress={handleDelete}
                accessibilityLabel={t("admin.mobile.festivalDetail.deleteFestival")}
                accessibilityHint={t("admin.mobile.festivalDetail.deleteFestivalHint")}
              >
                {deleteFestival.loading ? (
                  <ButtonSpinner />
                ) : (
                  <Trash2 size={16} color={IconColors.error} />
                )}
                <ButtonText>{t("admin.mobile.festivalDetail.deleteFestival")}</ButtonText>
              </Button>
            </VStack>
          </Card>

          <View className="h-4" />
        </VStack>
      </ScrollView>

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
