import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PaginationDotsProps {
  total: number;
  current: number;
}

export function PaginationDots({ total, current }: PaginationDotsProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center gap-1.5 py-2"
      style={{ paddingBottom: insets.bottom + 8 }}
    >
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          className={`rounded-full ${
            index === current
              ? "h-2.5 w-2.5 bg-yellow-500"
              : "h-2 w-2 bg-white/40"
          }`}
        />
      ))}
    </View>
  );
}
