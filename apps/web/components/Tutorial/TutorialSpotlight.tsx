"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { TUTORIAL_CONSTANTS } from "./constants";

interface TutorialSpotlightProps {
  target: string;
  isActive: boolean;
  className?: string;
}

export function TutorialSpotlight({
  target,
  isActive,
  className,
}: TutorialSpotlightProps) {
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) {
      startTransition(() => {
        setIsVisible(false);
      });
      return;
    }

    const updatePosition = () => {
      // For center position (welcome step), don't show spotlight
      if (target === "body") {
        setIsVisible(false);
        return;
      }

      const element = document.querySelector(target);
      if (!element) {
        setIsVisible(false);
        return;
      }

      const rect = element.getBoundingClientRect();

      // Use viewport coordinates for spotlight positioning
      setPosition({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
      setIsVisible(true);
    };

    // Initial position
    updatePosition();

    // Update on scroll and resize
    const handleUpdate = () => {
      requestAnimationFrame(updatePosition);
    };

    // More responsive scroll handling
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      handleUpdate();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        updatePosition();
      }, TUTORIAL_CONSTANTS.SCROLL_DEBOUNCE);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scrollend", updatePosition, { passive: true });
    window.addEventListener("resize", handleUpdate, { passive: true });

    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scrollend", updatePosition);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [target, isActive]);

  if (!isVisible || !isActive) {
    return null;
  }

  // Calculate the spotlight cutout dimensions with padding
  const padding = TUTORIAL_CONSTANTS.SPOTLIGHT_BORDER_OFFSET;
  const cutoutX = position.x - padding;
  const cutoutY = position.y - padding;
  const cutoutWidth = position.width + padding * 2;
  const cutoutHeight = position.height + padding * 2;

  // Create clip-path polygon for rectangular cutout
  // This creates a full-screen overlay with a rectangular hole
  const clipPath = `polygon(
    0% 0%,
    0% 100%,
    ${cutoutX}px 100%,
    ${cutoutX}px ${cutoutY}px,
    ${cutoutX + cutoutWidth}px ${cutoutY}px,
    ${cutoutX + cutoutWidth}px ${cutoutY + cutoutHeight}px,
    ${cutoutX}px ${cutoutY + cutoutHeight}px,
    ${cutoutX}px 100%,
    100% 100%,
    100% 0%
  )`;

  return (
    <div
      ref={spotlightRef}
      className={cn(
        "pointer-events-none fixed inset-0 z-50 transition-all duration-300",
        className,
      )}
    >
      {/* Dark overlay with rectangular cutout */}
      <div className="absolute inset-0 bg-black/50" style={{ clipPath }} />

      {/* Highlight border around the element */}
      <div
        className="absolute animate-pulse rounded-lg border-2 border-yellow-400 shadow-lg shadow-yellow-400/50"
        style={{
          left: cutoutX,
          top: cutoutY,
          width: cutoutWidth,
          height: cutoutHeight,
        }}
      />
    </div>
  );
}
