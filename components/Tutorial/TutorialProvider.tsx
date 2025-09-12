"use client";

import { TutorialProvider as TutorialContextProvider } from "@/contexts/TutorialContext";

import type { ReactNode } from "react";

interface TutorialProviderProps {
  children: ReactNode;
  tutorialCompleted?: boolean;
}

export function TutorialProvider({
  children,
  tutorialCompleted = false,
}: TutorialProviderProps) {
  return (
    <TutorialContextProvider initialTutorialCompleted={tutorialCompleted}>
      {children}
    </TutorialContextProvider>
  );
}
