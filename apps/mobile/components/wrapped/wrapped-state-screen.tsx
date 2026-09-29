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
    <View className="flex-1 items-center justify-center bg-wrapped-paper p-6">
      <VStack space="md" className="items-center">
        <Text className="text-center text-xl font-wrapped font-bold text-wrapped-ink">{title}</Text>
        {description ? (
          <Text className="text-center text-base text-wrapped-ink/70">{description}</Text>
        ) : null}
        <Pressable
          onPress={onClose}
          className="rounded-lg bg-wrapped-ink px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel={t("wrapped.close")}
          accessibilityHint={t("wrapped.story.a11y.closeHint")}
        >
          <Text className="font-semibold text-wrapped-paper">{t("wrapped.close")}</Text>
        </Pressable>
      </VStack>
    </View>
  );
}
