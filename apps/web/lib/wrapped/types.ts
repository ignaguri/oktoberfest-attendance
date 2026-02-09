/**
 * Web-specific wrapped types
 * Provider-specific types that depend on React DOM concepts
 */

import type { SlideConfig, SlideData } from "@prostcounter/shared/wrapped";
import type { ReactNode } from "react";

/**
 * Slide provider interface - allows swapping between web/Remotion/custom providers
 */
export interface ISlideProvider {
  name: "web" | "remotion" | "custom";
  renderSlide: (slideData: SlideData, config: SlideConfig) => ReactNode;
  exportImage?: (slideId: string) => Promise<Blob>;
  exportVideo?: () => Promise<Blob>;
}

/**
 * Share image options (web DOM-specific)
 */
export interface ShareImageOptions {
  slideId: string;
  format?: "png" | "jpeg";
  quality?: number; // 0-1
  width?: number;
  height?: number;
}
