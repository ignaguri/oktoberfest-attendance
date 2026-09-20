import { useAdminTents, useCreateAdminTent, useUpdateAdminTent } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Plus, Tent } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl } from "react-native";

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
import { IconColors } from "@/lib/constants/colors";

type Draft = { name: string; category: string };

const emptyDraft: Draft = { name: "", category: "" };

/**
 * The global tent catalogue.
 *
 * A tent exists independently of any festival; which festivals serve it, and at
 * what price, is edited from the festival's own tents screen. Renaming here
 * changes the tent everywhere.
 */
export default function AdminTentsScreen() {
  const { t } = useTranslation();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { tents, isLoading, error, refetch, isRefetching } = useAdminTents();
  const createTent = useCreateAdminTent();
  const updateTent = useUpdateAdminTent();

  const [newTent, setNewTent] = useState<Draft | null>(null);
  // Seeded on first edit rather than in an effect, so a background refetch
  // cannot overwrite in-progress typing.
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);

  const handleCreate = useCallback(async () => {
    if (!newTent) return;
    try {
      await createTent.mutate({
        name: newTent.name.trim(),
        category: newTent.category.trim() || null,
      });
      setNewTent(null);
    } catch {
      showDialog(t("common.status.error"), t("admin.mobile.tents.createError"));
    }
  }, [newTent, createTent, showDialog, t]);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    try {
      await updateTent.mutate({
        tentId: editing.id,
        data: {
          name: editing.draft.name.trim(),
          category: editing.draft.category.trim() || null,
        },
      });
      setEditing(null);
    } catch {
      showDialog(t("common.status.error"), t("admin.mobile.tents.updateError"));
    }
  }, [editing, updateTent, showDialog, t]);

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
          <Text className="text-sm text-typography-500">
            {t("admin.mobile.tents.catalogueHint")}
          </Text>

          {newTent ? (
            <Card size="md" variant="elevated">
              <VStack space="sm">
                <Text className="text-sm text-typography-500">
                  {t("admin.mobile.tents.nameLabel")}
                </Text>
                <Input>
                  <InputField
                    value={newTent.name}
                    onChangeText={(name) => setNewTent({ ...newTent, name })}
                    accessibilityLabel={t("admin.mobile.tents.nameLabel")}
                  />
                </Input>

                <Text className="text-sm text-typography-500">
                  {t("admin.mobile.tents.categoryLabel")}
                </Text>
                <Input>
                  <InputField
                    value={newTent.category}
                    onChangeText={(category) => setNewTent({ ...newTent, category })}
                    accessibilityLabel={t("admin.mobile.tents.categoryLabel")}
                  />
                </Input>

                <HStack space="sm">
                  <Button
                    variant="outline"
                    action="secondary"
                    className="flex-1"
                    onPress={() => setNewTent(null)}
                    accessibilityLabel={t("common.buttons.cancel")}
                  >
                    <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                  </Button>
                  <Button
                    className="flex-1"
                    isDisabled={newTent.name.trim().length === 0 || createTent.loading}
                    onPress={handleCreate}
                    accessibilityLabel={t("common.buttons.save")}
                  >
                    {createTent.loading && <ButtonSpinner />}
                    <ButtonText>{t("common.buttons.save")}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </Card>
          ) : (
            <Button
              variant="outline"
              onPress={() => setNewTent(emptyDraft)}
              accessibilityLabel={t("admin.mobile.tents.addTent")}
              accessibilityHint={t("admin.mobile.tents.addTentHint")}
            >
              <Plus size={16} color={IconColors.primary} />
              <ButtonText>{t("admin.mobile.tents.addTent")}</ButtonText>
            </Button>
          )}

          {isLoading && (
            <Text className="text-typography-500">{t("admin.mobile.tents.loading")}</Text>
          )}

          {!isLoading && tents.length === 0 && (
            <Card size="md" variant="elevated">
              <VStack space="xs" className="items-center py-6">
                <Tent size={32} color={IconColors.muted} />
                <Text className="text-typography-500">{t("admin.mobile.tents.empty")}</Text>
              </VStack>
            </Card>
          )}

          {tents.map((tent) =>
            editing?.id === tent.id ? (
              <Card key={tent.id} size="md" variant="elevated">
                <VStack space="sm">
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.tents.nameLabel")}
                  </Text>
                  <Input>
                    <InputField
                      value={editing.draft.name}
                      onChangeText={(name) =>
                        setEditing({ ...editing, draft: { ...editing.draft, name } })
                      }
                      accessibilityLabel={t("admin.mobile.tents.nameLabel")}
                    />
                  </Input>

                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.tents.categoryLabel")}
                  </Text>
                  <Input>
                    <InputField
                      value={editing.draft.category}
                      onChangeText={(category) =>
                        setEditing({ ...editing, draft: { ...editing.draft, category } })
                      }
                      accessibilityLabel={t("admin.mobile.tents.categoryLabel")}
                    />
                  </Input>

                  <Text className="text-sm text-typography-400">
                    {t("admin.mobile.tents.sharedHint")}
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
                      isDisabled={editing.draft.name.trim().length === 0 || updateTent.loading}
                      onPress={handleSave}
                      accessibilityLabel={t("common.buttons.save")}
                    >
                      {updateTent.loading && <ButtonSpinner />}
                      <ButtonText>{t("common.buttons.save")}</ButtonText>
                    </Button>
                  </HStack>
                </VStack>
              </Card>
            ) : (
              <Pressable
                key={tent.id}
                onPress={() =>
                  setEditing({
                    id: tent.id,
                    draft: { name: tent.name, category: tent.category ?? "" },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={tent.name}
                accessibilityHint={t("admin.mobile.tents.editHint")}
              >
                <Card size="md" variant="elevated">
                  <HStack className="items-center justify-between">
                    <VStack className="flex-1">
                      <Text className="font-semibold text-typography-900">{tent.name}</Text>
                      <Text className="text-sm text-typography-500">
                        {tent.category ?? t("admin.mobile.tents.uncategorized")}
                      </Text>
                    </VStack>
                    <Tent size={20} color={IconColors.muted} />
                  </HStack>
                </Card>
              </Pressable>
            ),
          )}

          <View className="h-4" />
        </VStack>
      </ScrollView>

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
