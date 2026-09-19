import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { ChevronRight, ShieldCheck } from "lucide-react-native";

import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { IconColors } from "@/lib/constants/colors";

/**
 * Entry point to the admin area, rendered on the profile tab.
 *
 * The caller decides whether to render this at all (profile.is_super_admin).
 * Hiding it is presentation only -- every admin endpoint is gated server-side
 * by the requireAdmin middleware, so a non-admin reaching /admin by deep link
 * sees a screen that cannot load any data.
 */
export function AdminSection() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Card size="md" variant="elevated">
      <Pressable
        className="flex-row items-center justify-between py-1"
        onPress={() => router.push("/admin")}
        accessibilityRole="button"
        accessibilityLabel={t("admin.mobile.openAdmin")}
        accessibilityHint={t("admin.mobile.openAdminHint")}
      >
        <View className="flex-row items-center gap-3">
          <ShieldCheck size={24} color={IconColors.primary} />
          <View>
            <Text className="text-lg font-semibold text-typography-900">
              {t("admin.pageTitle")}
            </Text>
            <Text className="text-sm text-typography-500">{t("admin.mobile.subtitle")}</Text>
          </View>
        </View>
        <ChevronRight size={24} color={IconColors.muted} />
      </Pressable>
    </Card>
  );
}
