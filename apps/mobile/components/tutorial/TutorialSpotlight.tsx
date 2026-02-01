/**
 * TutorialSpotlight - Dark overlay with transparent cutout around target
 *
 * Uses react-native-svg to create a mask effect that highlights the target component
 * while dimming the rest of the screen.
 */

import { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet } from "react-native";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

import { Colors } from "@/lib/constants/colors";
import {
  type TargetMeasurement,
  TUTORIAL_OPACITY,
  TUTORIAL_SIZING,
  TUTORIAL_TIMING,
} from "@/lib/tutorial";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Create AnimatedSvg outside component to avoid recreation on each render
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface TutorialSpotlightProps {
  /** Measurement of the target to highlight (null for centered steps) */
  targetMeasurement: TargetMeasurement | null;
  /** Whether the spotlight should be visible */
  visible: boolean;
}

export function TutorialSpotlight({
  targetMeasurement,
  visible,
}: TutorialSpotlightProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: TUTORIAL_TIMING.SPOTLIGHT_ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  if (!visible) return null;

  // For centered steps (no target), just show full overlay
  if (!targetMeasurement) {
    return (
      <AnimatedSvg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}
        pointerEvents="none"
      >
        <Rect
          x={0}
          y={0}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          fill={`rgba(0, 0, 0, ${TUTORIAL_OPACITY.OVERLAY_OPACITY})`}
        />
      </AnimatedSvg>
    );
  }

  // Calculate spotlight window dimensions with padding
  const padding = TUTORIAL_SIZING.SPOTLIGHT_PADDING;
  const borderRadius = TUTORIAL_SIZING.SPOTLIGHT_BORDER_RADIUS;
  const borderWidth = TUTORIAL_SIZING.SPOTLIGHT_BORDER_WIDTH;

  const spotlightX = targetMeasurement.pageX - padding;
  const spotlightY = targetMeasurement.pageY - padding;
  const spotlightWidth = targetMeasurement.width + padding * 2;
  const spotlightHeight = targetMeasurement.height + padding * 2;

  return (
    <AnimatedSvg
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}
      pointerEvents="none"
    >
      <Defs>
        {/* Mask: white = visible, black = transparent */}
        <Mask id="spotlight-mask">
          {/* Full white background (everything visible/dimmed) */}
          <Rect
            x={0}
            y={0}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            fill="white"
          />
          {/* Black rounded rect to create transparent cutout */}
          <Rect
            x={spotlightX}
            y={spotlightY}
            width={spotlightWidth}
            height={spotlightHeight}
            rx={borderRadius}
            ry={borderRadius}
            fill="black"
          />
        </Mask>
      </Defs>

      {/* Dark overlay with mask */}
      <Rect
        x={0}
        y={0}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        fill={`rgba(0, 0, 0, ${TUTORIAL_OPACITY.OVERLAY_OPACITY})`}
        mask="url(#spotlight-mask)"
      />

      {/* Highlight border around spotlight */}
      <Rect
        x={spotlightX}
        y={spotlightY}
        width={spotlightWidth}
        height={spotlightHeight}
        rx={borderRadius}
        ry={borderRadius}
        fill="transparent"
        stroke={Colors.primary[500]}
        strokeWidth={borderWidth}
      />
    </AnimatedSvg>
  );
}

TutorialSpotlight.displayName = "TutorialSpotlight";
