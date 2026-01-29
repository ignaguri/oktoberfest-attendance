import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack, useRouter } from "expo-router";
import { Beer } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/lib/constants/colors";

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const handleGoHome = () => {
    // Reset navigation stack and go to home
    router.dismissAll();
    router.replace("/(tabs)/index");
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("common.errors.oops"),
          headerShown: true,
        }}
      />
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Beer size={80} color={Colors.gray[300]} />
        <Text className="mt-6 text-2xl font-bold text-gray-900">
          {t("common.errors.notFound.title")}
        </Text>
        <Text className="mt-2 text-center text-gray-500">
          {t("common.errors.notFound.description")}
        </Text>
        <TouchableOpacity
          onPress={handleGoHome}
          className="mt-8 rounded-full bg-yellow-500 px-8 py-4 active:bg-yellow-600"
        >
          <Text className="text-center font-bold text-white">
            {t("common.buttons.goHome")}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
