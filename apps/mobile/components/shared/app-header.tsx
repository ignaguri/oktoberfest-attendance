import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Image } from "react-native";

const logoImage = require("@/assets/images/logo.png");

/**
 * App header component displaying the ProstCounter logo and name.
 * Used at the top of the Home screen for branding.
 */
export function AppHeader() {
  return (
    <HStack className="items-center justify-center py-2" space="md">
      <Image
        source={logoImage}
        style={{ width: 64, height: 64 }}
        resizeMode="contain"
        accessibilityLabel="ProstCounter Logo"
      />
      <HStack>
        <Text className="text-3xl font-extrabold text-primary-600">Prost</Text>
        <Text className="text-3xl font-extrabold text-primary-500">
          Counter
        </Text>
      </HStack>
    </HStack>
  );
}

AppHeader.displayName = "AppHeader";
