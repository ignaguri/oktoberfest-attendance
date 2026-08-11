import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

import type { GlyphId, PersistedUnlock } from "@prostcounter/shared/achievements";
import { batchEarnsConfetti, nameKeyFor } from "@prostcounter/shared/achievements";
import { useUnlockQueue } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";

import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";

/** Beyond this a stacked toast would overflow — the rest still counted in the title. */
const MAX_TOAST_BADGES = 3;
const TOAST_DURATION_MS = 5000;
const CONFETTI_DURATION_MS = 2200;

function unlockDestination(batch: PersistedUnlock[]) {
  if (batch.length !== 1) {
    return { pathname: "/achievements" as const };
  }
  return { pathname: "/achievements" as const, params: { highlight: batch[0].slug } };
}

/**
 * Watches the shared unlock queue and fires one stacked toast per batch,
 * with confetti when the batch's best rung is gold or platinum.
 *
 * Mounted once near the navigation root (see app/_layout.tsx). The toast body
 * itself is handed to gluestack's toast hook, which portals it above the
 * current screen; this component's own render only covers the confetti burst.
 */
export function UnlockToastHost() {
  const router = useRouter();
  const { batch, consume } = useUnlockQueue();
  const { t } = useTranslation();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [isExploding, setIsExploding] = useState(false);

  useEffect(() => {
    if (batch.length === 0) {
      return;
    }

    const destination = unlockDestination(batch);
    const isSingle = batch.length === 1;
    const title = isSingle
      ? t("achievements.unlock.single")
      : t("achievements.unlock.multiple", { count: batch.length });

    toast.show({
      placement: "top",
      duration: TOAST_DURATION_MS,
      render: ({ id }) => (
        <Pressable
          onPress={() => {
            toast.close(id);
            router.push(destination);
          }}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint={t("achievements.unlock.viewAction")}
        >
          <Toast nativeID={`toast-${id}`} action="success" variant="outline" className="mx-4 gap-2">
            <ToastTitle>{title}</ToastTitle>

            {isSingle && (
              <>
                <ToastDescription>{t(nameKeyFor(batch[0].slug))}</ToastDescription>
                <Text className="text-xs text-typography-500">
                  {t("achievements.unlock.points", { points: batch[0].points })}
                </Text>
              </>
            )}

            <HStack space="sm" className="items-center justify-between">
              <HStack space="sm" className="items-center">
                {batch.slice(0, MAX_TOAST_BADGES).map((entry) => (
                  <AchievementBadge
                    key={entry.eventId}
                    glyph={entry.glyph as GlyphId}
                    category={entry.category}
                    tier={entry.tier}
                    isUnlocked
                    size="sm"
                  />
                ))}
              </HStack>
              <Text className="text-xs font-medium text-success-800">
                {t("achievements.unlock.viewAction")}
              </Text>
            </HStack>
          </Toast>
        </Pressable>
      ),
    });

    if (batchEarnsConfetti(batch)) {
      setIsExploding(true);
      setTimeout(() => setIsExploding(false), CONFETTI_DURATION_MS);
    }

    consume();
  }, [batch, consume, router, t, toast]);

  return isExploding ? (
    <View className="absolute inset-0 z-50" pointerEvents="none">
      <ConfettiCannon
        count={30}
        origin={{ x: width / 2, y: 0 }}
        fadeOut
        explosionSpeed={350}
        fallSpeed={3000}
        autoStart
      />
    </View>
  ) : null;
}

UnlockToastHost.displayName = "UnlockToastHost";
