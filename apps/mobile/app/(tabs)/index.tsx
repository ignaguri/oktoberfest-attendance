import { ScrollView, ActivityIndicator } from "react-native";
import { useTranslation } from "@prostcounter/shared/i18n";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import {
  Button,
  ButtonText,
  Card,
  Badge,
  BadgeText,
  Avatar,
  AvatarFallbackText,
  AvatarBadge,
  VStack,
  HStack,
  Text,
  Heading,
} from "@/components/ui";

import { useAuth } from "@/lib/auth/AuthContext";
import { useFestival } from "@/lib/festival/FestivalContext";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentFestival, isLoading: festivalLoading } = useFestival();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <VStack space="md" className="p-4 pb-8">
        {/* Welcome Card */}
        <Card className="p-6">
          <VStack space="md" className="items-center">
            <Avatar size="xl">
              <AvatarFallbackText>
                {user?.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallbackText>
              <AvatarBadge />
            </Avatar>
            <Heading size="xl" className="mt-3">
              Welcome to ProstCounter!
            </Heading>
            <Text size="sm" className="text-gray-500 mt-1">
              {user?.email}
            </Text>
            <HStack space="sm" className="mt-3">
              <Badge action="info">
                <BadgeText>Pro User</BadgeText>
              </Badge>
              <Badge action="success">
                <BadgeText>Active</BadgeText>
              </Badge>
            </HStack>
          </VStack>
        </Card>

        {/* Festival Card */}
        <Card className="p-4">
          <VStack space="md">
            <HStack space="sm" className="items-center">
              <MaterialCommunityIcons
                name="calendar-star"
                size={24}
                color="#F59E0B"
              />
              <Heading size="md">Current Festival</Heading>
            </HStack>
            {festivalLoading ? (
              <ActivityIndicator color="#F59E0B" />
            ) : currentFestival ? (
              <VStack space="sm">
                <Heading size="lg">{currentFestival.name}</Heading>
                <HStack space="xs" className="items-center">
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={16}
                    color="#6B7280"
                  />
                  <Text className="text-gray-600">
                    {currentFestival.location}
                  </Text>
                </HStack>
                <Text size="sm" className="text-gray-500">
                  {currentFestival.startDate} - {currentFestival.endDate}
                </Text>
                {currentFestival.beerCost && (
                  <Badge action="warning" size="sm">
                    <BadgeText>
                      {currentFestival.beerCost} per beer
                    </BadgeText>
                  </Badge>
                )}
              </VStack>
            ) : (
              <Text className="text-gray-400 italic">No festival selected</Text>
            )}
          </VStack>
        </Card>

        {/* Quick Stats Card */}
        <Card className="p-4">
          <VStack space="md">
            <HStack space="sm" className="items-center">
              <MaterialCommunityIcons
                name="chart-bar"
                size={24}
                color="#F59E0B"
              />
              <Heading size="md">Your Stats</Heading>
            </HStack>
            <HStack className="justify-around">
              <VStack className="items-center">
                <Text size="2xl" bold className="text-amber-600">
                  0
                </Text>
                <Text size="xs" className="text-gray-500">
                  Beers
                </Text>
              </VStack>
              <VStack className="items-center">
                <Text size="2xl" bold className="text-amber-600">
                  0
                </Text>
                <Text size="xs" className="text-gray-500">
                  Days
                </Text>
              </VStack>
              <VStack className="items-center">
                <Text size="2xl" bold className="text-amber-600">
                  0
                </Text>
                <Text size="xs" className="text-gray-500">
                  Spent
                </Text>
              </VStack>
            </HStack>
          </VStack>
        </Card>

        {/* Quick Action */}
        <Button
          action="primary"
          size="lg"
          isDisabled
          className="rounded-full"
        >
          <MaterialCommunityIcons name="beer" size={20} color="white" />
          <ButtonText>Log Beer (Coming Soon)</ButtonText>
        </Button>
      </VStack>
    </ScrollView>
  );
}
