import { Beer, Citrus } from "lucide-react-native";
import { View } from "react-native";

interface RadlerIconProps {
  size: number;
  color: string;
  /** Background color for the garnish circle (defaults to white) */
  backgroundColor?: string;
}

/**
 * Composite icon for Radler (beer + citrus)
 * Beer with citrus garnish in top-right corner
 */
export function RadlerIcon({
  size,
  color,
  backgroundColor = "#FFFFFF",
}: RadlerIconProps) {
  const garnishSize = size * 0.55;

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      {/* Main Beer Glass */}
      <Beer size={size} color={color} />

      {/* Citrus Garnish - Positioned Top Right */}
      <View
        className="absolute rounded-full p-0.5"
        style={{
          top: -2,
          right: -4,
          backgroundColor,
        }}
      >
        <Citrus size={garnishSize} color={color} />
      </View>
    </View>
  );
}

RadlerIcon.displayName = "RadlerIcon";
