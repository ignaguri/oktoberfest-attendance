import { Image } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

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
        <Text className="text-primary-600 text-3xl font-extrabold">Prost</Text>
        <Text className="text-primary-500 text-3xl font-extrabold">
          Counter
        </Text>
      </HStack>
    </HStack>
  );
}

AppHeader.displayName = "AppHeader";
