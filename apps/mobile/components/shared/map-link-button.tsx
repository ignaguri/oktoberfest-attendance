import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import { useTranslation } from "@prostcounter/shared/i18n";
import { ExternalLink, Map } from "lucide-react-native";
import { Linking } from "react-native";

/**
 * External link button to open the festival map
 *
 * Features:
 * - Only renders if festival has a mapUrl configured
 * - Opens external URL via Linking API
 * - Shows map icon and external link indicator
 */
export function MapLinkButton() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();

  // Don't render if no map URL is configured
  if (!currentFestival?.mapUrl) {
    return null;
  }

  const handlePress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(currentFestival.mapUrl!);
      if (canOpen) {
        await Linking.openURL(currentFestival.mapUrl!);
      }
    } catch (error) {
      console.error("Failed to open map URL:", error);
    }
  };

  return (
    <Pressable onPress={handlePress}>
      <Card
        size="sm"
        variant="outline"
        className="bg-white active:bg-background-50"
      >
        <HStack space="sm" className="items-center">
          <Map size={20} color={IconColors.primary} />
          <Text className="flex-1 font-medium text-typography-900">
            {t("home.mapLink.title", { defaultValue: "Festival Map" })}
          </Text>
          <ExternalLink size={16} color={IconColors.muted} />
        </HStack>
      </Card>
    </Pressable>
  );
}

MapLinkButton.displayName = "MapLinkButton";
