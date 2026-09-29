"use client";

import { REVEAL_STEP_MS } from "@prostcounter/shared/wrapped";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  step: number;
  animate: boolean;
  kind?: "fadeUp" | "fade" | "stamp";
  className?: string;
  children: ReactNode;
}

const INITIAL = {
  fadeUp: { opacity: 0, y: 16 },
  fade: { opacity: 0 },
  stamp: { opacity: 0, scale: 1.2 },
} as const;

export function Reveal({ step, animate, kind = "fadeUp", className, children }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={animate ? INITIAL[kind] : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        kind === "stamp"
          ? { delay: (step * REVEAL_STEP_MS) / 1000, type: "spring", damping: 20, stiffness: 180 }
          : { delay: (step * REVEAL_STEP_MS) / 1000, duration: 0.35 }
      }
    >
      {children}
    </motion.div>
  );
}
