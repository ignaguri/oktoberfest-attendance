import type { CuriousFind } from "@prostcounter/shared";
import {
  useAdminFestivalOfficialStats,
  useUpdateAdminFestivalOfficialStats,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input, InputField } from "@/components/ui/input";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type NumberField = "visitors" | "massServed" | "mugsConfiscated" | "lostItems";
const NUMBER_FIELDS: NumberField[] = ["visitors", "massServed", "mugsConfiscated", "lostItems"];
const LOCALES = ["de", "en", "es"] as const;
const FIND_SLOTS = 3;

interface Draft {
  numbers: Record<NumberField, string>;
  sourceUrl: string;
  finds: CuriousFind[];
}

const emptyFind = (): CuriousFind => ({ de: "", en: "", es: "" });

/** Mirrors the server's `z.url({ protocol: /^https?$/ })` check, so a bad link gets the targeted error. */
const isHttpUrl = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};

export default function AdminFestivalOfficialStatsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dialog, showDialog, closeDialog } = useAlertDialog();
  const { stats, isLoading, error, refetch } = useAdminFestivalOfficialStats(id);
  const updateStats = useUpdateAdminFestivalOfficialStats();
  // Seeded on first edit, so a background refetch cannot overwrite typing
  const [draft, setDraft] = useState<Draft | null>(null);

  const current: Draft = draft ?? {
    numbers: {
      visitors: stats?.visitors?.toString() ?? "",
      massServed: stats?.massServed?.toString() ?? "",
      mugsConfiscated: stats?.mugsConfiscated?.toString() ?? "",
      lostItems: stats?.lostItems?.toString() ?? "",
    },
    sourceUrl: stats?.sourceUrl ?? "",
    finds: Array.from({ length: FIND_SLOTS }, (_, index) => stats?.curiousFinds[index] ?? emptyFind()),
  };

  const edit = useCallback(
    (change: (value: Draft) => Draft) => setDraft((value) => change(value ?? current)),
    [current],
  );

  const handleSave = useCallback(async () => {
    const parsed: Partial<Record<NumberField, number | null>> = {};
    for (const field of NUMBER_FIELDS) {
      const raw = current.numbers[field].trim();
      if (raw === "") {
        parsed[field] = null;
      } else if (/^\d+$/.test(raw)) {
        parsed[field] = Number(raw);
      } else {
        showDialog(t("common.status.error"), t("admin.mobile.festivalDetail.officialStats.invalidNumber"));
        return;
      }
    }
    const filled = current.finds.filter((find) => LOCALES.some((locale) => find[locale].trim() !== ""));
    if (filled.some((find) => LOCALES.some((locale) => find[locale].trim() === ""))) {
      showDialog(t("common.status.error"), t("admin.mobile.festivalDetail.officialStats.incompleteFind"));
      return;
    }
    const trimmedSourceUrl = current.sourceUrl.trim();
    if (trimmedSourceUrl !== "" && !isHttpUrl(trimmedSourceUrl)) {
      showDialog(t("common.status.error"), t("admin.mobile.festivalDetail.officialStats.invalidUrl"));
      return;
    }
    try {
      await updateStats.mutate({
        festivalId: id,
        data: {
          visitors: parsed.visitors ?? null,
          massServed: parsed.massServed ?? null,
          mugsConfiscated: parsed.mugsConfiscated ?? null,
          lostItems: parsed.lostItems ?? null,
          sourceUrl: trimmedSourceUrl === "" ? null : trimmedSourceUrl,
          curiousFinds: filled.map((find) => ({ de: find.de.trim(), en: find.en.trim(), es: find.es.trim() })),
        },
      });
      setDraft(null);
    } catch {
      showDialog(t("common.status.error"), t("admin.mobile.festivalDetail.officialStats.saveError"));
    }
  }, [current, id, updateStats, showDialog, t]);

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }
  if (isLoading) {
    return (
      <VStack className="flex-1 items-center justify-center">
        <Text>{t("admin.mobile.festivalDetail.loading")}</Text>
      </VStack>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <VStack space="md">
        <Text className="text-sm text-typography-500">{t("admin.mobile.festivalDetail.officialStats.hint")}</Text>
        <Card size="md" variant="elevated">
          <VStack space="md">
            {NUMBER_FIELDS.map((field) => (
              <VStack key={field} space="xs">
                <Text className="text-sm font-medium">{t(`admin.mobile.festivalDetail.officialStats.${field}`)}</Text>
                <Input>
                  <InputField
                    value={current.numbers[field]}
                    keyboardType="number-pad"
                    onChangeText={(value) =>
                      edit((draftValue) => ({ ...draftValue, numbers: { ...draftValue.numbers, [field]: value } }))
                    }
                    accessibilityLabel={t(`admin.mobile.festivalDetail.officialStats.${field}`)}
                    accessibilityHint={t("admin.mobile.festivalDetail.officialStats.hint")}
                  />
                </Input>
              </VStack>
            ))}
            <VStack space="xs">
              <Text className="text-sm font-medium">{t("admin.mobile.festivalDetail.officialStats.sourceUrl")}</Text>
              <Input>
                <InputField
                  value={current.sourceUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  onChangeText={(value) => edit((draftValue) => ({ ...draftValue, sourceUrl: value }))}
                  accessibilityLabel={t("admin.mobile.festivalDetail.officialStats.sourceUrl")}
                  accessibilityHint={t("admin.mobile.festivalDetail.officialStats.hint")}
                />
              </Input>
            </VStack>
          </VStack>
        </Card>

        <Card size="md" variant="elevated">
          <VStack space="md">
            <Text className="font-semibold">{t("admin.mobile.festivalDetail.officialStats.finds")}</Text>
            {current.finds.map((find, index) => (
              <VStack key={index} space="xs">
                <Text className="text-sm font-medium">
                  {t("admin.mobile.festivalDetail.officialStats.find", { number: index + 1 })}
                </Text>
                {LOCALES.map((locale) => {
                  const label = t(
                    `admin.mobile.festivalDetail.officialStats.locale${locale === "de" ? "De" : locale === "en" ? "En" : "Es"}`,
                  );
                  return (
                    <Input key={locale}>
                      <InputField
                        value={find[locale]}
                        placeholder={label}
                        maxLength={80}
                        onChangeText={(value) =>
                          edit((draftValue) => ({
                            ...draftValue,
                            finds: draftValue.finds.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, [locale]: value } : item,
                            ),
                          }))
                        }
                        accessibilityLabel={`${t("admin.mobile.festivalDetail.officialStats.find", { number: index + 1 })} ${label}`}
                        accessibilityHint={t("admin.mobile.festivalDetail.officialStats.incompleteFind")}
                      />
                    </Input>
                  );
                })}
              </VStack>
            ))}
          </VStack>
        </Card>

        <Button
          onPress={handleSave}
          isDisabled={updateStats.loading}
          accessibilityLabel={t("admin.mobile.festivalDetail.officialStats.save")}
          accessibilityHint={t("admin.mobile.festivalDetail.officialStats.saveHint")}
        >
          {updateStats.loading && <ButtonSpinner />}
          <ButtonText>{t("admin.mobile.festivalDetail.officialStats.save")}</ButtonText>
        </Button>
      </VStack>
      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </ScrollView>
  );
}
