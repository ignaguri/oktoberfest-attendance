import { useTranslation } from "@prostcounter/shared/i18n";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface WrappedStateScreenProps {
  title: string;
  description?: string;
  onClose: () => void;
}

export function WrappedStateScreen({ title, description, onClose }: WrappedStateScreenProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-yellow-50 p-6">
      <VStack space="md" className="items-center">
        <Text className="text-center text-xl font-bold text-typography-900">{title}</Text>
        {description ? (
          <Text className="text-center text-base text-typography-600">{description}</Text>
        ) : null}
        <Pressable
          onPress={onClose}
          className="rounded-lg bg-primary-500 px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel={t("wrapped.close")}
          accessibilityHint={t("wrapped.close")}
        >
          <Text className="font-semibold text-white">{t("wrapped.close")}</Text>
        </Pressable>
      </VStack>
    </View>
  );
}
