import { useTranslation } from "@prostcounter/shared/i18n";
import { WifiOff } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface OfflineScreenProps {
  /** i18n key for the description message */
  messageKey: string;
}

/**
 * Full-screen offline guard for screens that require server aggregation.
 * Shows a centered icon with title and a parametrizable description.
 */
export function OfflineScreen({ messageKey }: OfflineScreenProps) {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={["top"]}>
      <VStack className="flex-1 items-center justify-center p-6">
        <WifiOff size={48} color={IconColors.disabled} />
        <Text className="mt-4 text-center text-lg font-semibold text-typography-700">
          {t("common.offline.title")}
        </Text>
        <Text className="mt-2 text-center text-typography-500">
          {t(messageKey)}
        </Text>
      </VStack>
    </SafeAreaView>
  );
}
