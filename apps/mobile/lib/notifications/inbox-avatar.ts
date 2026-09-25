/**
 * Whether an inbox notification's avatar can be drawn with React Native's
 * Image. Workflows without a person behind them (achievements, reminders) use
 * Novu's stock SVG avatars, and Image renders an SVG as an empty box, so those
 * get the fallback icon instead.
 */
export function canRenderInboxAvatar(avatar: string | null | undefined): boolean {
  if (!avatar) {
    return false;
  }
  const path = avatar.split(/[?#]/)[0];
  return !path.toLowerCase().endsWith(".svg");
}
