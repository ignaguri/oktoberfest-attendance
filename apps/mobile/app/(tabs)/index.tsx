import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useTranslation } from "@prostcounter/shared/i18n";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { useAuth } from "@/lib/auth/AuthContext";
import { useFestival } from "@/lib/festival/FestivalContext";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentFestival, isLoading: festivalLoading } = useFestival();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 pb-8">
        {/* Welcome Card */}
        <View className="bg-white rounded-xl p-6 mb-4 shadow-sm items-center">
          <MaterialCommunityIcons name="beer" size={48} color="#F59E0B" />
          <Text className="text-xl font-bold text-gray-900 mt-3">
            Welcome to ProstCounter!
          </Text>
          <Text className="text-gray-600 mt-1">{user?.email}</Text>
        </View>

        {/* Festival Card */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons
              name="calendar-star"
              size={24}
              color="#F59E0B"
            />
            <Text className="text-lg font-semibold text-gray-900 ml-2">
              Current Festival
            </Text>
          </View>

          {festivalLoading ? (
            <ActivityIndicator color="#F59E0B" />
          ) : currentFestival ? (
            <View className="gap-2">
              <Text className="text-lg font-bold text-gray-900">
                {currentFestival.name}
              </Text>
              <View className="flex-row items-center">
                <MaterialCommunityIcons
                  name="map-marker"
                  size={16}
                  color="#6B7280"
                />
                <Text className="text-gray-600 ml-1">
                  {currentFestival.location}
                </Text>
              </View>
              <Text className="text-gray-500 text-sm">
                {currentFestival.startDate} - {currentFestival.endDate}
              </Text>
              {currentFestival.beerCost && (
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="currency-eur"
                    size={16}
                    color="#6B7280"
                  />
                  <Text className="text-gray-600 ml-1">
                    {currentFestival.beerCost}€ per beer
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text className="text-gray-400 italic">No festival selected</Text>
          )}
        </View>

        {/* Coming Soon Card */}
        <View className="bg-white rounded-xl p-6 mb-4 shadow-sm items-center">
          <MaterialCommunityIcons
            name="rocket-launch"
            size={32}
            color="#9CA3AF"
          />
          <Text className="text-lg font-medium text-gray-500 mt-3">
            More Features Coming Soon!
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            Quick beer registration, statistics, and more will be available in
            the next update.
          </Text>
        </View>

        {/* Quick Action - Disabled for now */}
        <View className="bg-yellow-200 rounded-full py-4 opacity-50">
          <Text className="text-center font-bold text-gray-500">
            Log Beer (Coming Soon)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
