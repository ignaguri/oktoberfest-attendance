export interface StoryState {
  index: number;
  total: number;
  revealComplete: boolean;
}

export type StoryAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "revealDone" }
  | { type: "replay" };

export const REVEAL_STEP_MS = 350;

/** How long a slide's reveal runs before the shell marks it done. */
export function revealDurationMs(steps: number): number {
  return steps * REVEAL_STEP_MS + 400;
}

export function initialStoryState(total: number): StoryState {
  return { index: 0, total, revealComplete: false };
}

/**
 * Tap-only story. "next" during a reveal jumps to its end frame instead of
 * moving; "prev" shows the previous slide's end frame; the last slide has
 * explicit buttons, so "next" there does nothing.
 */
export function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case "next": {
      if (!state.revealComplete) {
        return { ...state, revealComplete: true };
      }
      if (state.index >= state.total - 1) {
        return state;
      }
      return { ...state, index: state.index + 1, revealComplete: false };
    }
    case "prev": {
      if (state.index === 0) {
        return state;
      }
      return { ...state, index: state.index - 1, revealComplete: true };
    }
    case "revealDone": {
      if (state.revealComplete) {
        return state;
      }
      return { ...state, revealComplete: true };
    }
    case "replay": {
      return initialStoryState(state.total);
    }
  }
}
