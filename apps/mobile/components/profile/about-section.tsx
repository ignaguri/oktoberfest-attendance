import { PROD_URL } from "@prostcounter/shared/constants";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { LucideIcon } from "lucide-react-native";
import {
  Bug,
  ChevronRight,
  Lightbulb,
  Share2,
  Shield,
  Sparkles,
  Star,
} from "lucide-react-native";
import { useCallback } from "react";

import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useRatePrompt } from "@/hooks/useRatePrompt";
import { useShareApp } from "@/hooks/useShareApp";
import { IconColors } from "@/lib/constants/colors";
import { logger } from "@/lib/logger";

const LINKS = [
  {
    key: "privacy" as const,
    url: `${PROD_URL}/privacy`,
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
] satisfies { key: string; url: string; Icon: LucideIcon }[];

function ActionRow({
  label,
  Icon,
  onPress,
  accessibilityRole = "button",
  bordered = false,
}: {
  label: string;
  Icon: LucideIcon;
  onPress: () => void | Promise<void>;
  accessibilityRole?: "button" | "link";
  bordered?: boolean;
}) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-between py-3",
        bordered && "border-b border-outline-100",
      )}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
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

function LinkRow({
  label,
  url,
  Icon,
  bordered,
}: {
  label: string;
  url: string;
  Icon: LucideIcon;
  bordered?: boolean;
}) {
  const handlePress = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      logger.error("Failed to open URL:", error);
    }
  }, [url]);

  return (
    <ActionRow
      label={label}
      Icon={Icon}
      onPress={handlePress}
      accessibilityRole="link"
      bordered={bordered}
    />
  );
}

export function AboutSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestReviewManually } = useRatePrompt();
  const shareApp = useShareApp();

  return (
    <Card size="md" variant="elevated">
      <Text className="mb-2 text-lg font-semibold text-typography-900">
        {t("profile.about.title")}
      </Text>

      <VStack>
        <ActionRow
          label={t("profile.about.whatsNew")}
          Icon={Sparkles}
          onPress={() => router.push("/settings/whats-new")}
          bordered
        />
        <ActionRow
          label={t("profile.about.rateApp")}
          Icon={Star}
          onPress={requestReviewManually}
          bordered
        />
        <ActionRow
          label={t("profile.about.shareApp")}
          Icon={Share2}
          onPress={shareApp}
          bordered
        />

        {LINKS.map((link, index) => (
          <LinkRow
            key={link.key}
            label={t(`profile.about.${link.key}`)}
            url={link.url}
            Icon={link.Icon}
            bordered={index < LINKS.length - 1}
          />
        ))}
      </VStack>
    </Card>
  );
}
