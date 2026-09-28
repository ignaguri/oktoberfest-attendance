import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import type { ViewShotRef } from "react-native-view-shot";

import { logger } from "@/lib/logger";

/**
 * Hook for capturing and sharing the wrapped share image
 */
export function useWrappedShare(data: WrappedData, shareRef: React.RefObject<ViewShotRef | null>) {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);

  // Generate localized share text
  const shareText = useMemo(() => {
    const { totalBeers, daysAttended } = data.basicStats;
    const festivalHashtag = data.festivalInfo.name.replace(/[^\p{L}\p{N}]/gu, "");

    return (
      `${t("wrapped.shareText.title", { festivalName: data.festivalInfo.name })}\n\n` +
      `${t("wrapped.shareText.stats", { beers: totalBeers, days: daysAttended })}\n` +
      `${t("wrapped.shareText.personality", { type: data.personality.type })}\n\n` +
      `#${festivalHashtag} #ProstCounter`
    );
  }, [data, t]);

  const handleShare = useCallback(async () => {
    if (!shareRef.current?.capture) return;

    setIsSharing(true);
    try {
      // Capture the view as a PNG
      const uri = await shareRef.current.capture();

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        logger.warn("Sharing is not available on this device");
        return;
      }

      // Open native share sheet
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: shareText,
      });
    } catch (error) {
      logger.error("Failed to share wrapped", error);
    } finally {
      setIsSharing(false);
    }
  }, [shareRef, shareText]);

  return { handleShare, isSharing };
}
