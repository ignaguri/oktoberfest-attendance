export type LiveActivityAction = "start" | "update" | "end" | "restart" | "none";

export interface DecideInput {
  supported: boolean;
  enabled: boolean;
  signedIn: boolean;
  festival: { id: string; startDate: string; endDate: string } | null;
  /** Festival-local YYYY-MM-DD. */
  today: string;
  /** Today has a drink or a tent visit (buildLiveActivityState returned a state). */
  hasState: boolean;
  /** Past the inactivity window since the last log. */
  stale: boolean;
  running: { festivalId: string; date: string } | null;
}

export function decideLiveActivity(input: DecideInput): LiveActivityAction {
  if (!input.supported) {
    return "none";
  }

  const festivalDay =
    input.festival !== null &&
    input.today >= input.festival.startDate &&
    input.today <= input.festival.endDate;
  const shouldShow =
    input.enabled && input.signedIn && festivalDay && input.hasState && !input.stale;

  if (!input.running) {
    return shouldShow ? "start" : "none";
  }
  if (!shouldShow) {
    return "end";
  }
  if (input.running.festivalId !== input.festival?.id || input.running.date !== input.today) {
    return "restart";
  }
  return "update";
}
