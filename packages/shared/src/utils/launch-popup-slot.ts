/**
 * One launch popup per app session.
 *
 * The first popup to claim the slot holds it until it releases it; later
 * claimants back off. A module variable is the session: web reloads and
 * mobile cold starts reset it. Only the feedback prompt claims it today;
 * the other launch popups can adopt it without changing this module.
 */
let holder: string | null = null;

export function claimLaunchPopupSlot(owner: string): boolean {
  if (holder === null || holder === owner) {
    holder = owner;
    return true;
  }
  return false;
}

export function releaseLaunchPopupSlot(owner: string): void {
  if (holder === owner) {
    holder = null;
  }
}

export function isLaunchPopupSlotClaimed(): boolean {
  return holder !== null;
}

export function resetLaunchPopupSlotForTests(): void {
  holder = null;
}
