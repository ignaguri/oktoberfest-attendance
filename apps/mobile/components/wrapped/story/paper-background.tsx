import { WRAPPED_STORY_THEME } from "@prostcounter/shared/wrapped";
import { View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";

/** Cream paper with the faint blue-white rhombus pattern. */
export function PaperBackground() {
  return (
    <View className="absolute inset-0 bg-wrapped-paper" pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="wrapped-rhombus" width={28} height={28} patternUnits="userSpaceOnUse">
            <Path
              d="M14 0 L28 14 L14 28 L0 14 Z"
              fill={WRAPPED_STORY_THEME.patternBlue}
              fillOpacity={WRAPPED_STORY_THEME.patternOpacity}
            />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#wrapped-rhombus)" />
      </Svg>
    </View>
  );
}
