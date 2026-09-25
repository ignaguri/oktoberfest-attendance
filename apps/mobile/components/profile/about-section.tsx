import { INSTAGRAM_URL, PROD_URL } from "@prostcounter/shared/constants";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { LucideIcon } from "lucide-react-native";
import {
  Bug,
  Camera,
  ChevronRight,
  Lightbulb,
  Share2,
  Shield,
  Sparkles,
  Star,
} from "lucide-react-native";
import { useCallback, useState } from "react";

import { FeedbackSheet } from "@/components/feedback/feedback-sheet";
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
  const [feedbackKind, setFeedbackKind] = useState<"bug" | "idea" | null>(null);

  // Linking rather than the in-app browser, so the Instagram app opens when installed.
  const openInstagram = useCallback(async () => {
    try {
      await Linking.openURL(INSTAGRAM_URL);
    } catch (error) {
      logger.error("Failed to open Instagram:", error);
    }
  }, []);

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
        <ActionRow label={t("profile.about.shareApp")} Icon={Share2} onPress={shareApp} bordered />
        <ActionRow
          label={t("profile.about.followInstagram")}
          Icon={Camera}
          onPress={openInstagram}
          accessibilityRole="link"
          bordered
        />

        <ActionRow
          label={t("profile.about.reportBug")}
          Icon={Bug}
          onPress={() => setFeedbackKind("bug")}
          bordered
        />
        <ActionRow
          label={t("profile.about.requestFeature")}
          Icon={Lightbulb}
          onPress={() => setFeedbackKind("idea")}
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

      <FeedbackSheet
        isOpen={feedbackKind !== null}
        mode={{ kind: feedbackKind ?? "bug" }}
        onClose={() => setFeedbackKind(null)}
      />
    </Card>
  );
}
