"use client";

import { useState, useCallback } from "react";

export function useConfetti(duration: number = 2200) {
  const [isExploding, setIsExploding] = useState(false);

  const triggerConfetti = useCallback(() => {
    setIsExploding(true);
    // Reset after animation duration (duration ms, default 2200ms as per small config)
    setTimeout(() => {
      setIsExploding(false);
    }, duration);
  }, [duration]);

  return { isExploding, triggerConfetti };
}
