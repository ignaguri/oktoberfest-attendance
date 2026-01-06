import { View, Text, TouchableOpacity, Alert } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "@prostcounter/shared/i18n";

import { useAuth } from "@/lib/auth/AuthContext";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      t("profile.signOut.title"),
      t("profile.signOut.message"),
      [
        {
          text: t("common.buttons.cancel"),
          style: "cancel",
        },
        {
          text: t("profile.signOut.confirm"),
          style: "destructive",
          onPress: signOut,
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4">
        {/* Profile Header */}
        <View className="bg-white rounded-xl p-6 mb-4 shadow-sm items-center">
          <View className="w-20 h-20 bg-yellow-100 rounded-full items-center justify-center mb-4">
            <MaterialCommunityIcons name="account" size={48} color="#F59E0B" />
          </View>
          <Text className="text-lg font-bold text-gray-900">
            {user?.email}
          </Text>
        </View>

        {/* Coming Soon */}
        <View className="bg-white rounded-xl p-6 mb-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-2">
            Profile Settings
          </Text>
          <Text className="text-gray-500">
            Edit your profile, manage notifications, and view achievements.
            Coming soon!
          </Text>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          className="bg-red-500 rounded-xl py-4 active:bg-red-600"
          onPress={handleSignOut}
        >
          <Text className="text-center font-bold text-white">
            {t("profile.signOut.button")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
