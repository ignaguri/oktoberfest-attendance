import { cn } from "@prostcounter/ui";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";

interface TextProps {
  children: ReactNode;
  className?: string;
}

export function StoryKicker({ children, className }: TextProps) {
  return (
    <Text className={cn("text-xs font-bold uppercase tracking-widest text-wrapped-ink/70", className)}>
      {children}
    </Text>
  );
}

export function StoryHeading({ children, className }: TextProps) {
  return (
    <Text className={cn("font-wrapped text-4xl font-extrabold leading-tight text-wrapped-ink", className)}>
      {children}
    </Text>
  );
}

export function StoryBig({ children, className }: TextProps) {
  return (
    <Text className={cn("font-wrapped text-8xl font-extrabold leading-none text-wrapped-ink", className)}>
      {children}
    </Text>
  );
}

export function StoryBody({ children, className }: TextProps) {
  return <Text className={cn("text-lg leading-relaxed text-wrapped-ink", className)}>{children}</Text>;
}

export function StoryNote({ children, className }: TextProps) {
  return <Text className={cn("text-sm text-wrapped-ink/60", className)}>{children}</Text>;
}

/** Amber pill, slightly rotated, like a stamp on the paper. */
export function StoryStamp({ children, className }: TextProps) {
  return (
    <View className={cn("-rotate-3 self-start rounded-full bg-wrapped-amber px-4 py-1.5", className)}>
      <Text className="text-sm font-extrabold text-wrapped-ink">{children}</Text>
    </View>
  );
}
