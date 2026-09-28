import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TextProps {
  children: ReactNode;
  className?: string;
}

export function StoryKicker({ children, className }: TextProps) {
  return <p className={cn("text-xs font-bold tracking-widest text-wrapped-ink/70 uppercase", className)}>{children}</p>;
}

export function StoryHeading({ children, className }: TextProps) {
  return <h2 className={cn("font-wrapped text-4xl leading-tight font-extrabold text-wrapped-ink", className)}>{children}</h2>;
}

export function StoryBig({ children, className }: TextProps) {
  return <p className={cn("font-wrapped text-8xl leading-none font-extrabold text-wrapped-ink", className)}>{children}</p>;
}

export function StoryBody({ children, className }: TextProps) {
  return <p className={cn("text-lg leading-relaxed text-wrapped-ink", className)}>{children}</p>;
}

export function StoryNote({ children, className }: TextProps) {
  return <p className={cn("text-sm text-wrapped-ink/60", className)}>{children}</p>;
}

export function StoryStamp({ children, className }: TextProps) {
  return (
    <span
      className={cn(
        "inline-block -rotate-3 self-start rounded-full bg-wrapped-amber px-4 py-1.5 text-sm font-extrabold text-wrapped-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
