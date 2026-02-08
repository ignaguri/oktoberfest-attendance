import { useTranslation } from "@prostcounter/shared/i18n";
import * as WebBrowser from "expo-web-browser";
import type { LucideIcon } from "lucide-react-native";
import {
  Beer,
  Bug,
  ChevronRight,
  Lightbulb,
  Shield,
} from "lucide-react-native";
import { useCallback } from "react";

import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { logger } from "@/lib/logger";

const LINKS = [
  {
    key: "privacy" as const,
    url: "https://prostcounter.fun/privacy",
    Icon: Shield,
  },
  {
    key: "reportBug" as const,
    url: "https://prostcounter.canny.io/bugs",
    Icon: Bug,
  },
  {
    key: "requestFeature" as const,
    url: "https://prostcounter.canny.io/feature-requests",
    Icon: Lightbulb,
  },
  {
    key: "buyMeABeer" as const,
    url: "https://www.paypal.me/ignacioguri",
    Icon: Beer,
  },
] satisfies { key: string; url: string; Icon: LucideIcon }[];

function LinkRow({
  label,
  url,
  Icon,
}: {
  label: string;
  url: string;
  Icon: LucideIcon;
}) {
  const handlePress = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      logger.error("Failed to open URL:", error);
    }
  }, [url]);

  return (
    <Pressable
      className="flex-row items-center justify-between py-3"
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <View className="flex-row items-center gap-3">
        <Icon size={20} color={IconColors.default} />
        <Text className="text-typography-900">{label}</Text>
      </View>
      <ChevronRight size={20} color={IconColors.muted} />
    </Pressable>
  );
}

export function AboutSection() {
  const { t } = useTranslation();

  return (
    <Card size="md" variant="elevated">
      <Text className="mb-2 text-lg font-semibold text-typography-900">
        {t("profile.about.title")}
      </Text>

      <VStack>
        {LINKS.map((link, index) => (
          <View
            key={link.key}
            className={
              index < LINKS.length - 1
                ? "border-b border-outline-100"
                : undefined
            }
          >
            <LinkRow
              label={t(`profile.about.${link.key}`)}
              url={link.url}
              Icon={link.Icon}
            />
          </View>
        ))}
      </VStack>
    </Card>
  );
}
