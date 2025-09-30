"use client";

import { useState, useCallback } from "react";

export function useConfetti() {
  const [isExploding, setIsExploding] = useState(false);

  const triggerConfetti = useCallback(() => {
    setIsExploding(true);
    // Reset after animation duration (2200ms as per small config)
    setTimeout(() => {
      setIsExploding(false);
    }, 2200);
  }, []);

  return { isExploding, triggerConfetti };
}
