import { View, Text } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function LeaderboardScreen() {
  return (
    <View className="flex-1 bg-gray-50 justify-center items-center p-6">
      <MaterialCommunityIcons name="trophy" size={64} color="#D1D5DB" />
      <Text className="text-xl font-bold text-gray-400 mt-4">Leaderboard</Text>
      <Text className="text-gray-400 text-center mt-2">
        See how you rank against other festival-goers. Coming soon!
      </Text>
    </View>
  );
}
