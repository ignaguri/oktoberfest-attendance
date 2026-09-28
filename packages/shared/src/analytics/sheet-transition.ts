/** What an isOpen change means for sheet_opened / sheet_abandoned. */
export function sheetTransition(
  wasOpen: boolean,
  isOpen: boolean,
  submitted: boolean,
): "opened" | "abandoned" | null {
  if (!wasOpen && isOpen) {
    return "opened";
  }
  if (wasOpen && !isOpen && !submitted) {
    return "abandoned";
  }
  return null;
}
