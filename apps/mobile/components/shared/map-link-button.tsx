import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import { useTranslation } from "@prostcounter/shared/i18n";
import * as WebBrowser from "expo-web-browser";
import { Map } from "lucide-react-native";

/**
 * External link button to open the festival map
 *
 * Features:
 * - Only renders if festival has a mapUrl configured
 * - Opens URL in in-app browser (Safari View Controller / Chrome Custom Tab)
 * - Shows map icon indicator
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
      await WebBrowser.openBrowserAsync(currentFestival.mapUrl!);
    } catch (error) {
      console.error("Failed to open map URL:", error);
    }
  };

  return (
    <Button
      variant="outline"
      action="secondary"
      size="md"
      onPress={handlePress}
      className="justify-start bg-white"
    >
      <HStack space="sm" className="flex-1 items-center">
        <Map size={20} color={IconColors.primary} />
        <Text className="flex-1 font-medium text-typography-900">
          {t("home.mapLink.title", { defaultValue: "Festival Map" })}
        </Text>
      </HStack>
    </Button>
  );
}

MapLinkButton.displayName = "MapLinkButton";
