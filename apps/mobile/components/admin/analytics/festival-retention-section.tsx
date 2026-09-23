import { useAdminAnalyticsFestivalRetention } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatPercent, retentionRates } from "@prostcounter/shared/utils";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { SectionState } from "./section-state";

export function FestivalRetentionSection() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useAdminAnalyticsFestivalRetention();

  const festivals = data?.festivals ?? [];

  return (
    <SectionState
      isLoading={loading}
      error={error}
      isEmpty={festivals.every((festival) => festival.attendees === 0)}
      onRetry={() => {
        void refetch();
      }}
    >
      <VStack space="md">
        <Text className="text-sm text-typography-500">{t("admin.analytics.retention.hint")}</Text>
        {festivals.map((festival) => {
          const rates = retentionRates(festival);
          return (
            <Card key={festival.festivalId} size="sm" variant="outline">
              <VStack space="xs">
                <Text className="font-semibold text-typography-900">{festival.festivalName}</Text>
                <HStack className="justify-between">
                  <Text className="text-sm text-typography-500">
                    {t("admin.analytics.retention.attendees")}
                  </Text>
                  <Text className="text-sm text-typography-900">{festival.attendees}</Text>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-sm text-typography-500">
                    {t("admin.analytics.retention.returnedNext")}
                  </Text>
                  <Text className="text-sm text-typography-900">
                    {festival.returnedNext === null
                      ? t("admin.analytics.retention.pending")
                      : `${festival.returnedNext} (${formatPercent(rates.next)})`}
                  </Text>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-sm text-typography-500">
                    {t("admin.analytics.retention.returnedAny")}
                  </Text>
                  <Text className="text-sm text-typography-900">
                    {`${festival.returnedAny} (${formatPercent(rates.any)})`}
                  </Text>
                </HStack>
              </VStack>
            </Card>
          );
        })}
      </VStack>
    </SectionState>
  );
}
