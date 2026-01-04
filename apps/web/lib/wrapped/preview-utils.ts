import { toPng } from "html-to-image";

/**
 * Generate share image using proper html-to-image approach with refs
 */
export async function generateShareImageFromElement(
  element: HTMLElement,
): Promise<Blob | null> {
  try {
    // Detect Safari for specific handling
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Safari-specific options for better compatibility
    const options = {
      cacheBust: true,
      backgroundColor: "#ffffff",
      width: 1080,
      height: 1920,
      canvasWidth: 1080,
      canvasHeight: 1920,
      // Safari-specific options
      useCORS: true,
      allowTaint: false,
      // Ensure fonts are loaded
      fontEmbedCSS: await getFontEmbedCSS(element),
      // Better image handling for Safari
      pixelRatio: isSafari ? 1 : window.devicePixelRatio || 1,
      // Force style recalculation
      style: {
        transform: "scale(1)",
        transformOrigin: "top left",
        // Additional Safari fixes
        ...(isSafari && {
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }),
      },
      // Safari-specific filter to handle problematic elements
      ...(isSafari && {
        filter: (domNode: HTMLElement) => {
          // Ensure images are properly loaded
          if (domNode.tagName === "IMG") {
            const imgElement = domNode as HTMLImageElement;
            return imgElement.complete && imgElement.naturalHeight !== 0;
          }
          return true;
        },
      }),
    };

    const dataUrl = await toPng(element, options);

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    return blob;
  } catch (error) {
    console.error("Failed to capture image:", error);
    return null;
  }
}

/**
 * Get font embed CSS for better Safari compatibility
 */
async function getFontEmbedCSS(element: HTMLElement): Promise<string> {
  try {
    // Import getFontEmbedCSS from html-to-image
    const { getFontEmbedCSS } = await import("html-to-image");
    return await getFontEmbedCSS(element);
  } catch (error) {
    console.warn("Failed to get font embed CSS:", error);
    return "";
  }
}
