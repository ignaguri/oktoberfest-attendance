/** A collection card is 5:7, like a trading card. */
const CARD_RATIO = 5 / 7;
/** Leaves the neighbouring cards' paging gutter visible. */
const MAX_WIDTH_RATIO = 0.86;
/** The crest is what the card shows off; its PNG has ~15% padding per side. */
const CREST_WIDTH_RATIO = 0.85;

/** The largest 5:7 card that fits the measured area, and its crest size. */
export function personaCardSize(area: { width: number; height: number }) {
  if (area.width <= 0 || area.height <= 0) {
    return null;
  }
  const width = Math.round(Math.min(area.width * MAX_WIDTH_RATIO, area.height * CARD_RATIO));
  return {
    width,
    height: Math.round(width / CARD_RATIO),
    crest: Math.round(width * CREST_WIDTH_RATIO),
  };
}
