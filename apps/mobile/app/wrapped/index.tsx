import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { hasWrappedData } from "@prostcounter/shared/wrapped";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { WrappedPager } from "@/components/wrapped/wrapped-pager";
import { useWrappedData } from "@/hooks/useWrappedData";
import { Colors, IconColors } from "@/lib/constants/colors";

export default function WrappedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentFestival } = useFestival();
  const {
    data: wrappedData,
    loading,
    error,
  } = useWrappedData(currentFestival?.id);

  const handleClose = () => {
    router.back();
  };

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-yellow-50">
        <VStack space="md" className="items-center">
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text className="text-base text-gray-600">
            {t("wrapped.loading")}
          </Text>
        </VStack>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-yellow-50 p-6">
        <VStack space="md" className="items-center">
          <Text className="text-center text-base text-gray-600">
            {t("wrapped.error")}
          </Text>
          <Pressable
            onPress={handleClose}
            className="rounded-lg bg-primary-500 px-6 py-3"
          >
            <Text className="font-semibold text-white">
              {t("wrapped.close")}
            </Text>
          </Pressable>
        </VStack>
      </View>
    );
  }

  // No data state
  if (!wrappedData || !hasWrappedData(wrappedData)) {
    return (
      <View className="flex-1 items-center justify-center bg-yellow-50 p-6">
        <VStack space="md" className="items-center">
          <Text className="text-center text-base text-gray-600">
            {t("wrapped.accessDenied")}
          </Text>
          <Pressable
            onPress={handleClose}
            className="rounded-lg bg-primary-500 px-6 py-3"
          >
            <Text className="font-semibold text-white">
              {t("wrapped.close")}
            </Text>
          </Pressable>
        </VStack>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Close button */}
      <Pressable
        onPress={handleClose}
        className="absolute right-4 z-50 rounded-full bg-black/30 p-2"
        style={{ top: insets.top + 8 }}
        accessibilityLabel={t("wrapped.close")}
        accessibilityRole="button"
      >
        <X size={24} color={IconColors.white} />
      </Pressable>

      {/* Wrapped content */}
      <WrappedPager data={wrappedData} onClose={handleClose} />
    </View>
  );
}
