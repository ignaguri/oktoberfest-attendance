export interface TutorialStep {
  id: string;
  target: string; // CSS selector or data attribute
  /** Translation key for this step (e.g., "tutorial.welcome") */
  translationKey: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  action?: "click" | "scroll" | "wait";
  required?: boolean;
  delay?: number; // Delay before showing this step (ms)
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    target: "body",
    translationKey: "tutorial.welcome",
    position: "center",
    delay: 0,
  },
  {
    id: "festival-status",
    target: '[data-tutorial="festival-status"]',
    translationKey: "tutorial.festivalStatus",
    position: "bottom",
    delay: 500,
  },
  {
    id: "quick-attendance",
    target: '[data-tutorial="quick-attendance"]',
    translationKey: "tutorial.quickAttendance",
    position: "bottom",
    delay: 300,
  },
  {
    id: "highlights",
    target: '[data-tutorial="highlights"]',
    translationKey: "tutorial.highlights",
    position: "top",
    delay: 300,
  },
  {
    id: "groups",
    target: '[data-tutorial="groups"]',
    translationKey: "tutorial.groups",
    position: "top",
    delay: 300,
  },
  {
    id: "calendar-nav",
    target: '[data-tutorial="calendar-nav"]',
    translationKey: "tutorial.calendarNav",
    position: "bottom",
    delay: 300,
  },
  {
    id: "user-menu",
    target: '[data-tutorial="user-menu"]',
    translationKey: "tutorial.userMenu",
    position: "bottom",
    delay: 300,
  },
  {
    id: "map-share",
    target: '[data-tutorial="map-share"]',
    translationKey: "tutorial.mapShare",
    position: "top",
    delay: 300,
  },
  {
    id: "tutorial-complete",
    target: "body",
    translationKey: "tutorial.complete",
    position: "center",
    delay: 300,
  },
];

export const getTutorialStep = (stepId: string): TutorialStep | undefined => {
  return tutorialSteps.find((step) => step.id === stepId);
};

export const getTutorialStepIndex = (stepId: string): number => {
  return tutorialSteps.findIndex((step) => step.id === stepId);
};

export const getNextStep = (
  currentStepId: string,
): TutorialStep | undefined => {
  const currentIndex = getTutorialStepIndex(currentStepId);
  return currentIndex >= 0 && currentIndex < tutorialSteps.length - 1
    ? tutorialSteps[currentIndex + 1]
    : undefined;
};

export const getPreviousStep = (
  currentStepId: string,
): TutorialStep | undefined => {
  const currentIndex = getTutorialStepIndex(currentStepId);
  return currentIndex > 0 ? tutorialSteps[currentIndex - 1] : undefined;
};
