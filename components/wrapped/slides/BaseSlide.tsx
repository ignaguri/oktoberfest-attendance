"use client";

import { cn } from "@/lib/utils";
import { WRAPPED_THEME } from "@/lib/wrapped/config";
import { motion } from "framer-motion";

import type { AnimationConfig } from "@/lib/wrapped/types";
import type { ReactNode } from "react";

interface BaseSlideProps {
  children: ReactNode;
  className?: string;
  animation?: AnimationConfig;
  backgroundColor?: string;
}

/**
 * Base slide component with animations and theming
 * All specific slide components should use this as a wrapper
 */
export function BaseSlide({
  children,
  className,
  animation,
  backgroundColor = WRAPPED_THEME.backgroundColor,
}: BaseSlideProps) {
  const entranceAnimation = {
    fade: { opacity: 0 },
    slide: { x: 100, opacity: 0 },
    zoom: { scale: 0.8, opacity: 0 },
    none: {},
  };

  const exitAnimation = {
    fade: { opacity: 0 },
    slide: { x: -100, opacity: 0 },
    zoom: { scale: 1.2, opacity: 0 },
    none: {},
  };

  const entrance = animation?.entrance || "fade";
  const exit = animation?.exit || "fade";
  const duration = (animation?.duration || 500) / 1000; // Convert to seconds

  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center p-8",
        "overflow-hidden",
        className,
      )}
      style={{ backgroundColor }}
    >
      <motion.div
        initial={entranceAnimation[entrance]}
        animate={{ x: 0, scale: 1, opacity: 1 }}
        exit={exitAnimation[exit]}
        transition={{
          duration,
          ease: "easeInOut",
          type: entrance === "zoom" ? "spring" : "tween",
        }}
        className="size-full flex flex-col items-center justify-center"
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Slide title component
 */
export function SlideTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.h1
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className={cn(
        "mb-4 text-center text-4xl font-bold",
        "text-gray-800",
        className,
      )}
    >
      {children}
    </motion.h1>
  );
}

/**
 * Slide subtitle component
 */
export function SlideSubtitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.p
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className={cn("mb-8 text-center text-lg text-gray-600", className)}
    >
      {children}
    </motion.p>
  );
}

/**
 * Slide content wrapper with stagger animation
 */
export function SlideContent({
  children,
  className,
  stagger = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
}) {
  if (!stagger) {
    return <div className={cn("w-full max-w-2xl", className)}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1,
            delayChildren: 0.4,
          },
        },
      }}
      className={cn("w-full max-w-2xl", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated stat item
 */
export function StatItem({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  icon?: string;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 },
      }}
      className={cn(
        "flex items-center justify-between rounded-lg bg-white p-4 shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-3xl">{icon}</span>}
        <span className="text-lg font-medium text-gray-700">{label}</span>
      </div>
      <span className="text-2xl font-bold text-yellow-600">{value}</span>
    </motion.div>
  );
}
