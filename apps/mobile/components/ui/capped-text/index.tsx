import React from "react";
import { Text, TextInput } from "react-native";

/**
 * Largest system font scale the app honours. 1.35 covers every standard iOS
 * text size (up to xxxLarge); only the accessibility sizes, which reach ~3.1x,
 * get clamped, since single-line rows cannot survive them.
 */
export const MAX_FONT_SIZE_MULTIPLIER = 1.35;

export const CappedText = React.forwardRef<
  React.ComponentRef<typeof Text>,
  React.ComponentProps<typeof Text>
>(function CappedText(props, ref) {
  return <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} {...props} ref={ref} />;
});

export const CappedTextInput = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  React.ComponentProps<typeof TextInput>
>(function CappedTextInput(props, ref) {
  return <TextInput maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} {...props} ref={ref} />;
});
