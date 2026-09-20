import { useApiClient } from "@prostcounter/shared/data";
import { useAdminFestivals, useCopyAdminFestivalTents } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AdminFestivalTent } from "@prostcounter/shared/schemas";
import { CalendarDays, X } from "lucide-react-native";
import { useCallback, useState } from "react";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface CopyTentsSheetProps {
  festivalId: string;
  isOpen: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onCopied: (count: number) => void;
}

/**
 * Copies a whole festival's tent line-up into this one.
 *
 * Prices come across with the tents; tents the target already serves are
 * skipped server-side, so this cannot overwrite a price already set here.
 */
export function CopyTentsSheet({
  festivalId,
  isOpen,
  onClose,
  onError,
  onCopied,
}: CopyTentsSheetProps) {
  const { t } = useTranslation();
  const apiClient = useApiClient();

  // Only fetched while open, so the tents screen's first load stays cheap.
  const { festivals, isLoading } = useAdminFestivals(isOpen);
  const copyTents = useCopyAdminFestivalTents();

  const [busyFestivalId, setBusyFestivalId] = useState<string | null>(null);

  const sources = festivals.filter((festival) => festival.id !== festivalId);

  const handleCopy = useCallback(
    async (sourceFestivalId: string) => {
      setBusyFestivalId(sourceFestivalId);
      try {
        // The copy endpoint takes explicit tent ids, so the source's current
        // line-up is read first rather than assumed. Typed at the call site
        // because shared's ApiClient is deliberately `any` to break a cycle.
        const { tents }: { tents: AdminFestivalTent[] } =
          await apiClient.admin.tents.forFestival(sourceFestivalId);

        if (tents.length === 0) {
          onError(t("admin.mobile.festivalTents.sourceEmpty"));
          return;
        }

        const { copied } = await copyTents.mutate({
          festivalId,
          data: {
            source_festival_id: sourceFestivalId,
            tent_ids: tents.map((tent) => tent.tent_id),
            copy_prices: true,
          },
        });

        onCopied(copied);
        onClose();
      } catch {
        onError(t("admin.mobile.festivalTents.copyError"));
      } finally {
        setBusyFestivalId(null);
      }
    },
    [apiClient, copyTents, festivalId, onClose, onCopied, onError, t],
  );

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <HStack className="mb-4 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">
            {t("admin.mobile.festivalTents.copyFrom")}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t("common.buttons.close")}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="px-2 pb-4">
            <Text className="text-sm text-typography-500">
              {t("admin.mobile.festivalTents.copyHint")}
            </Text>

            {isLoading && (
              <Text className="text-typography-500">{t("admin.mobile.festivals.loading")}</Text>
            )}

            {!isLoading && sources.length === 0 && (
              <VStack space="xs" className="items-center py-6">
                <CalendarDays size={32} color={IconColors.muted} />
                <Text className="text-typography-500">
                  {t("admin.mobile.festivalTents.noOtherFestivals")}
                </Text>
              </VStack>
            )}

            {sources.map((festival) => (
              <Pressable
                key={festival.id}
                disabled={busyFestivalId !== null}
                onPress={() => handleCopy(festival.id)}
                accessibilityRole="button"
                accessibilityLabel={festival.name}
                accessibilityHint={t("admin.mobile.festivalTents.copyFromHint")}
              >
                <Card size="sm" variant="elevated">
                  <HStack className="items-center justify-between">
                    <VStack className="flex-1">
                      <Text className="text-typography-900">{festival.name}</Text>
                      <Text className="text-sm text-typography-500">
                        {festival.start_date} – {festival.end_date}
                      </Text>
                    </VStack>
                    {busyFestivalId === festival.id && <Spinner size="small" />}
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
