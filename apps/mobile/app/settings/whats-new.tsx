import { useTranslation } from "@prostcounter/shared/i18n";
import * as Application from "expo-application";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { changelog } from "@/lib/changelog";

export default function WhatsNewScreen() {
  const { t } = useTranslation();

  const sortedVersions = Object.keys(changelog).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }),
  );

  const currentVersion = Application.nativeApplicationVersion ?? "1.0.0";

  return (
    <ScrollView className="flex-1 bg-background-50">
      <VStack space="md" className="p-4">
        <Text className="text-center text-sm text-typography-400">
          {t("whatsNew.currentVersion", { version: currentVersion })}
        </Text>

        {sortedVersions.map((version) => (
          <View key={version} className="rounded-2xl bg-white p-4 shadow-sm">
            <Text className="mb-3 text-lg font-semibold text-typography-900">
              {t("whatsNew.versionLabel", { version })}
            </Text>
            <VStack space="sm">
              {changelog[version].map((feature, index) => (
                <View key={index} className="flex-row gap-2">
                  <Text className="text-typography-500">•</Text>
                  <Text className="flex-1 text-typography-700">{feature}</Text>
                </View>
              ))}
            </VStack>
          </View>
        ))}
      </VStack>
    </ScrollView>
  );
}
