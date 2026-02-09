import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import type ViewShot from "react-native-view-shot";

import { logger } from "@/lib/logger";

/**
 * Hook for capturing and sharing the wrapped share image
 */
export function useWrappedShare(
  data: WrappedData,
  shareRef: React.RefObject<ViewShot | null>,
) {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);

  // Generate localized share text
  const shareText = useMemo(() => {
    const { total_beers, days_attended } = data.basic_stats;
    const festivalHashtag = data.festival_info.name.replace(
      /[^\p{L}\p{N}]/gu,
      "",
    );

    return (
      `${t("wrapped.shareText.title", { festivalName: data.festival_info.name })}\n\n` +
      `${t("wrapped.shareText.stats", { beers: total_beers, days: days_attended })}\n` +
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
