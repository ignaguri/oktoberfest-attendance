import { useTranslation } from "@prostcounter/shared/i18n";
import { Image } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

const logoImage = require("@/assets/images/logo.png");

/**
 * App header component displaying the ProstCounter logo and name.
 * Used at the top of the Home screen for branding.
 */
export function AppHeader() {
  const { t } = useTranslation();

  return (
    <HStack className="items-center justify-center py-2" space="md">
      <Image
        source={logoImage}
        style={{ width: 64, height: 64 }}
        resizeMode="contain"
        accessibilityLabel={t("app.logo")}
      />
      <HStack>
        <Text className="text-3xl font-extrabold text-primary-600">
          {t("app.namePart1")}
        </Text>
        <Text className="text-3xl font-extrabold text-primary-500">
          {t("app.namePart2")}
        </Text>
      </HStack>
    </HStack>
  );
}

AppHeader.displayName = "AppHeader";
