"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, SkipForward } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import type { TutorialStep } from "@/lib/tutorialSteps";

import { TUTORIAL_CONSTANTS } from "./constants";

interface TutorialTooltipProps {
  step: TutorialStep;
  isActive: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  currentStepIndex: number;
  totalSteps: number;
}

export function TutorialTooltip({
  step,
  isActive,
  onNext,
  onPrevious,
  onSkip,
  onClose,
  canGoNext,
  canGoPrevious,
  currentStepIndex,
  totalSteps,
}: TutorialTooltipProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) {
      setIsVisible(false);
      return;
    }

    const updatePosition = () => {
      const element = document.querySelector(step.target);
      if (!element) {
        setIsVisible(false);
        return;
      }

      const rect = element.getBoundingClientRect();

      // Use a more reliable width calculation
      const tooltipWidth = TUTORIAL_CONSTANTS.TOOLTIP_DEFAULT_WIDTH;
      const tooltipHeight = TUTORIAL_CONSTANTS.TOOLTIP_DEFAULT_HEIGHT;

      let x = 0;
      let y = 0;

      // Adjust position based on step position preference
      switch (step.position) {
        case "center":
          x = window.innerWidth / 2 - tooltipWidth / 2;
          y = window.innerHeight / 2 - tooltipHeight / 2;
          break;
        case "top":
          x = rect.left + rect.width / 2 - tooltipWidth / 2;
          y = rect.top - tooltipHeight - TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
          break;
        case "bottom":
          x = rect.left + rect.width / 2 - tooltipWidth / 2;
          y = rect.bottom + TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
          break;
        case "left":
          x = rect.left - tooltipWidth - TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
          y = rect.top + rect.height / 2 - tooltipHeight / 2;
          break;
        case "right":
          x = rect.right + TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
          y = rect.top + rect.height / 2 - tooltipHeight / 2;
          break;
        default:
          // Default to top position with horizontal centering
          x = rect.left + rect.width / 2 - tooltipWidth / 2;
          y = rect.top - tooltipHeight - TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
      }

      // Keep tooltip within viewport
      x = Math.max(
        TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
        Math.min(
          x,
          window.innerWidth - tooltipWidth - TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
        ),
      );
      y = Math.max(
        TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
        Math.min(
          y,
          window.innerHeight -
            tooltipHeight -
            TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
        ),
      );

      setPosition({ x, y });
      setIsVisible(true);
    };

    // Initial position
    updatePosition();

    // Update position after tooltip is rendered to get accurate dimensions
    const updateAfterRender = () => {
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const element = document.querySelector(step.target);
        if (element) {
          const rect = element.getBoundingClientRect();
          const tooltipWidth = tooltipRect.width;
          const tooltipHeight = tooltipRect.height;

          let x = 0;
          let y = 0;

          // Recalculate with actual dimensions
          switch (step.position) {
            case "center":
              x = window.innerWidth / 2 - tooltipWidth / 2;
              y = window.innerHeight / 2 - tooltipHeight / 2;
              break;
            case "top":
              x = rect.left + rect.width / 2 - tooltipWidth / 2;
              y = rect.top - tooltipHeight - TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
              break;
            case "bottom":
              x = rect.left + rect.width / 2 - tooltipWidth / 2;
              y = rect.bottom + TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
              break;
            case "left":
              x = rect.left - tooltipWidth - TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
              y = rect.top + rect.height / 2 - tooltipHeight / 2;
              break;
            case "right":
              x = rect.right + TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
              y = rect.top + rect.height / 2 - tooltipHeight / 2;
              break;
            default:
              x = rect.left + rect.width / 2 - tooltipWidth / 2;
              y = rect.top - tooltipHeight - TUTORIAL_CONSTANTS.TOOLTIP_OFFSET;
          }

          // Keep tooltip within viewport
          x = Math.max(
            TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
            Math.min(
              x,
              window.innerWidth -
                tooltipWidth -
                TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
            ),
          );
          y = Math.max(
            TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
            Math.min(
              y,
              window.innerHeight -
                tooltipHeight -
                TUTORIAL_CONSTANTS.TOOLTIP_PADDING,
            ),
          );

          setPosition({ x, y });
        }
      }
    };

    // Update position after a short delay to ensure tooltip is rendered
    const renderTimer = setTimeout(
      updateAfterRender,
      TUTORIAL_CONSTANTS.RENDER_DELAY,
    );

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
      clearTimeout(renderTimer);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scrollend", updatePosition);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [step, isActive]);

  if (!isVisible || !isActive) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-6 max-w-sm transition-all duration-300",
        "animate-in fade-in-0 zoom-in-95",
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          Step {currentStepIndex + 1} of {totalSteps}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="size-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {step.title}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className="h-8"
          >
            <ChevronLeft className="size-4 mr-1" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={onSkip} className="h-8">
            <SkipForward className="size-4 mr-1" />
            Skip
          </Button>
        </div>

        <Button
          onClick={onNext}
          className="h-8 bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          {canGoNext ? (
            <>
              Next
              <ChevronRight className="size-4 ml-1" />
            </>
          ) : (
            "Get Started! 🍻"
          )}
        </Button>
      </div>
    </div>
  );
}
