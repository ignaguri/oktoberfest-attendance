import type { WrappedData } from "@prostcounter/shared/wrapped";
import { generateShareText } from "@prostcounter/shared/wrapped";
import * as Sharing from "expo-sharing";
import { useCallback, useState } from "react";
import type ViewShot from "react-native-view-shot";

/**
 * Hook for capturing and sharing the wrapped share image
 */
export function useWrappedShare(
  data: WrappedData,
  shareRef: React.RefObject<ViewShot | null>,
) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!shareRef.current?.capture) return;

    setIsSharing(true);
    try {
      // Capture the view as a PNG
      const uri = await shareRef.current.capture();

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.warn("Sharing is not available on this device");
        return;
      }

      // Open native share sheet
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: generateShareText(data),
      });
    } catch (error) {
      console.error("Failed to share wrapped:", error);
    } finally {
      setIsSharing(false);
    }
  }, [data, shareRef]);

  return { handleShare, isSharing };
}
