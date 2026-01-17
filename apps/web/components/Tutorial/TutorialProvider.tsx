"use client";

import type { ReactNode } from "react";

import { TutorialProvider as TutorialContextProvider } from "@/contexts/TutorialContext";

interface TutorialProviderProps {
  children: ReactNode;
  tutorialCompleted?: boolean;
  isLoadingStatus?: boolean;
}

export function TutorialProvider({
  children,
  tutorialCompleted = false,
  isLoadingStatus = false,
}: TutorialProviderProps) {
  return (
    <TutorialContextProvider
      initialTutorialCompleted={tutorialCompleted}
      isLoadingStatus={isLoadingStatus}
    >
      {children}
    </TutorialContextProvider>
  );
}
