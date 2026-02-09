import { Motion } from "@legendapp/motion";
import { useFestival } from "@prostcounter/shared/contexts";
import { useWrappedAccess } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { Pressable } from "react-native";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface WrappedCTAProps {
  isLastDayOfFestival?: boolean;
}

export function WrappedCTA({ isLastDayOfFestival }: WrappedCTAProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentFestival } = useFestival();
  const { data: accessResult, loading } = useWrappedAccess(currentFestival?.id);

  // Don't show if loading or no current festival
  if (loading || !currentFestival) {
    return null;
  }

  // Don't show if not last day and access not allowed
  if (!isLastDayOfFestival && (!accessResult || !accessResult.allowed)) {
    return null;
  }

  const festivalName = currentFestival.name;
  const isReady = !isLastDayOfFestival && accessResult?.allowed;

  return (
    <Motion.View
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "timing", duration: 500 }}
    >
      <Card
        size="lg"
        variant="elevated"
        className="overflow-hidden border-2 border-yellow-400 bg-yellow-50 p-4"
      >
        <VStack space="md" className="items-center">
          <Sparkles size={28} color={IconColors.default} />

          <Text className="text-center text-lg font-bold text-gray-800">
            {isReady ? t("wrapped.cta.ready") : t("wrapped.cta.preparing")}
          </Text>

          <Text className="text-center text-sm text-gray-600">
            {isReady
              ? t("wrapped.cta.readyDescription", { festivalName })
              : t("wrapped.cta.preparingDescription", { festivalName })}
          </Text>

          {isReady && (
            <Pressable
              // @ts-ignore - Route exists but typed routes haven't been regenerated yet
              onPress={() => router.push("/wrapped")}
              className="mt-1 rounded-lg bg-yellow-500 px-6 py-3"
              accessibilityLabel={t("wrapped.cta.viewButton")}
              accessibilityRole="button"
            >
              <Text className="font-semibold text-white">
                {t("wrapped.cta.viewButton")}
              </Text>
            </Pressable>
          )}
        </VStack>
      </Card>
    </Motion.View>
  );
}
