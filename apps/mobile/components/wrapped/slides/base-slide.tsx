import { Motion } from "@legendapp/motion";
import { cn } from "@prostcounter/ui";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface BaseSlideProps {
  children: React.ReactNode;
  isActive: boolean;
  backgroundClassName?: string;
}

/**
 * Base slide wrapper providing safe area, animation, and gradient background
 */
export function BaseSlide({
  children,
  isActive,
  backgroundClassName = "bg-yellow-50",
}: BaseSlideProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn("flex-1", backgroundClassName)}
      style={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 24,
      }}
    >
      <Motion.View
        initial={{ opacity: 0 }}
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ type: "timing", duration: 400 }}
        style={{ flex: 1 }}
      >
        {children}
      </Motion.View>
    </View>
  );
}

interface SlideTitleProps {
  children: string;
  isActive: boolean;
  delay?: number;
}

export function SlideTitle({ children, isActive, delay = 0 }: SlideTitleProps) {
  return (
    <Motion.View
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
      transition={{ type: "timing", duration: 500, delay }}
    >
      <Text className="text-center text-3xl font-bold text-gray-800">
        {children}
      </Text>
    </Motion.View>
  );
}

interface SlideSubtitleProps {
  children: string;
  isActive: boolean;
  delay?: number;
}

export function SlideSubtitle({
  children,
  isActive,
  delay = 100,
}: SlideSubtitleProps) {
  return (
    <Motion.View
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 10 }}
      transition={{ type: "timing", duration: 400, delay }}
    >
      <Text className="text-center text-base text-gray-500">{children}</Text>
    </Motion.View>
  );
}

interface StatItemProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  isActive: boolean;
  delay?: number;
}

export function StatItem({
  label,
  value,
  icon,
  isActive,
  delay = 0,
}: StatItemProps) {
  return (
    <Motion.View
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
      transition={{ type: "timing", duration: 400, delay }}
      className="items-center rounded-2xl bg-white/70 p-4"
    >
      {icon && <View className="mb-2">{icon}</View>}
      <Text className="text-2xl font-bold text-gray-800">{value}</Text>
      <Text className="mt-1 text-sm text-gray-500">{label}</Text>
    </Motion.View>
  );
}

interface SlideContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SlideContent({ children, className = "" }: SlideContentProps) {
  return (
    <VStack space="md" className={cn("flex-1 justify-center", className)}>
      {children}
    </VStack>
  );
}
