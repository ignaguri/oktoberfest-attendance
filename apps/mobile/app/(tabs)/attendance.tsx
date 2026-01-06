import { View, Text } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function AttendanceScreen() {
  return (
    <View className="flex-1 bg-gray-50 justify-center items-center p-6">
      <MaterialCommunityIcons name="beer" size={64} color="#D1D5DB" />
      <Text className="text-xl font-bold text-gray-400 mt-4">
        Attendance Tracking
      </Text>
      <Text className="text-gray-400 text-center mt-2">
        Log your daily beer consumption and tent visits. Coming soon!
      </Text>
    </View>
  );
}
