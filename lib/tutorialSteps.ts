export interface TutorialStep {
  id: string;
  target: string; // CSS selector or data attribute
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  action?: "click" | "scroll" | "wait";
  required?: boolean;
  delay?: number; // Delay before showing this step (ms)
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    target: "body",
    title: "Welcome to ProstCounter! 🍻",
    description:
      "Let's take a quick guided tour of the app to help you get started with tracking your beer festival adventures.",
    position: "center",
    delay: 0,
  },
  {
    id: "festival-status",
    target: '[data-tutorial="festival-status"]',
    title: "Festival Status",
    description:
      "This shows you the current status of the festival and whether you can log attendances.",
    position: "bottom",
    delay: 500,
  },
  {
    id: "quick-attendance",
    target: '[data-tutorial="quick-attendance"]',
    title: "Quick Attendance",
    description:
      "Log your daily beer consumption here. This is the main feature of the app!",
    position: "bottom",
    delay: 300,
  },
  {
    id: "highlights",
    target: '[data-tutorial="highlights"]',
    title: "Your Stats",
    description:
      "View your personal statistics, achievements, and highlights here.",
    position: "top",
    delay: 300,
  },
  {
    id: "groups",
    target: '[data-tutorial="groups"]',
    title: "Groups",
    description:
      "Join or create groups to compete with friends during the festival.",
    position: "top",
    delay: 300,
  },
  {
    id: "calendar-nav",
    target: '[data-tutorial="calendar-nav"]',
    title: "Calendar",
    description:
      "Click the calendar icon to view your attendance calendar and manage your schedule.",
    position: "bottom",
    delay: 300,
  },
  {
    id: "user-menu",
    target: '[data-tutorial="user-menu"]',
    title: "Navigation Menu",
    description:
      "Click on your avatar or name to open the menu with all navigation options like Profile, Groups, Leaderboard, and more.",
    position: "bottom",
    delay: 300,
  },
  {
    id: "map-share",
    target: '[data-tutorial="map-share"]',
    title: "Map & Share",
    description: "Access the festival map and share the app with friends.",
    position: "top",
    delay: 300,
  },
  {
    id: "tutorial-complete",
    target: "body",
    title: "Tutorial Complete! 🎉",
    description:
      "You've seen the main features of ProstCounter! You can always reset this tutorial in your profile settings if you want to see it again. Now go enjoy the festival and track those beers!",
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
