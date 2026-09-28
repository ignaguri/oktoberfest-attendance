import { type PersonaId, WRAPPED_STORY_THEME } from "@prostcounter/shared/wrapped";
import { Image } from "react-native";
import Svg, { Path } from "react-native-svg";

import { getCrestImage } from "./crest-images";

/** The persona's crest PNG, or a plain stamped shield until one exists. */
export function Crest({ personaId }: { personaId: PersonaId }) {
  const source = getCrestImage(personaId);
  if (source) {
    return (
      <Image
        source={source}
        className="h-40 w-40"
        // Decorative: the persona name is always rendered next to the crest.
        // alt alone makes RN treat the image as accessible/focusable, so it
        // must be paired with aria-hidden to actually hide it from a11y.
        alt=""
        aria-hidden
        importantForAccessibility="no"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <Svg
      width={140}
      height={160}
      viewBox="0 0 132 150"
      // Decorative: the persona name is always rendered next to the crest.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M66 4 L124 22 V74 C124 110 98 134 66 146 C34 134 8 110 8 74 V22 Z"
        fill="#FFFFFF"
        stroke={WRAPPED_STORY_THEME.ink}
        strokeWidth={4}
      />
      <Path
        d="M66 18 L112 32 V74 C112 102 92 122 66 132 C40 122 20 102 20 74 V32 Z"
        fill={WRAPPED_STORY_THEME.patternBlue}
        fillOpacity={0.14}
      />
      <Path d="M40 74 H92" stroke={WRAPPED_STORY_THEME.stampAmber} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}
