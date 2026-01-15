"use client";

import { TutorialProvider as TutorialContextProvider } from "@/contexts/TutorialContext";

import type { ReactNode } from "react";

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
