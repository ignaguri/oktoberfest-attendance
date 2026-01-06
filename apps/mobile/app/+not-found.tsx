import { View, Text, TouchableOpacity } from "react-native";
import { Link, Stack } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!", headerShown: true }} />
      <View className="flex-1 bg-white items-center justify-center p-6">
        <MaterialCommunityIcons name="beer-outline" size={80} color="#D1D5DB" />
        <Text className="text-2xl font-bold text-gray-900 mt-6">
          Page Not Found
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          Looks like this page wandered off to another tent!
        </Text>
        <Link href="/(tabs)" asChild>
          <TouchableOpacity className="mt-8 bg-yellow-500 px-8 py-4 rounded-full active:bg-yellow-600">
            <Text className="text-white font-bold text-center">Go to Home</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}
