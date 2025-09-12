"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";

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
      setIsVisible(false);
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
    let scrollTimeout: NodeJS.Timeout;
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

  return (
    <div
      ref={spotlightRef}
      className={cn(
        "fixed inset-0 pointer-events-none z-50 transition-all duration-300",
        className,
      )}
      style={{
        background: `radial-gradient(circle at ${position.x + position.width / 2}px ${position.y + position.height / 2}px, transparent 0px, transparent ${Math.max(position.width, position.height) / 2 + TUTORIAL_CONSTANTS.SPOTLIGHT_GRADIENT_OFFSET}px, rgba(0, 0, 0, 0.5) ${Math.max(position.width, position.height) / 2 + TUTORIAL_CONSTANTS.SPOTLIGHT_GRADIENT_FADE}px)`,
      }}
    >
      {/* Highlight border around the element */}
      <div
        className="absolute border-2 border-yellow-400 rounded-lg shadow-lg shadow-yellow-400/50 animate-pulse"
        style={{
          left: position.x - TUTORIAL_CONSTANTS.SPOTLIGHT_BORDER_OFFSET,
          top: position.y - TUTORIAL_CONSTANTS.SPOTLIGHT_BORDER_OFFSET,
          width:
            position.width + TUTORIAL_CONSTANTS.SPOTLIGHT_BORDER_OFFSET * 2,
          height:
            position.height + TUTORIAL_CONSTANTS.SPOTLIGHT_BORDER_OFFSET * 2,
        }}
      />
    </div>
  );
}
