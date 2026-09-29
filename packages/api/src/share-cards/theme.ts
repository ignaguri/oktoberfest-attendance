import { WRAPPED_STORY_THEME } from "@prostcounter/shared/wrapped/server";

export const CARD_SIZE = { width: 1080, height: 1920 } as const;
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const COLORS = {
  paper: WRAPPED_STORY_THEME.paper,
  ink: WRAPPED_STORY_THEME.ink,
  amber: WRAPPED_STORY_THEME.stampAmber,
  blue: WRAPPED_STORY_THEME.patternBlue,
  white: "#FFFFFF",
  inkFaint: "rgba(22, 50, 92, 0.35)",
} as const;

const RHOMBUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="M30 0 L60 30 L30 60 L0 30 Z" fill="none" stroke="${COLORS.blue}" stroke-opacity="0.1" stroke-width="3"/><path d="M30 12 L48 30 L30 48 L12 30 Z" fill="${COLORS.blue}" fill-opacity="0.1"/></svg>`;

/** The paper's rhombus tile, as Satori wants a background image. */
export const PATTERN = `url("data:image/svg+xml;base64,${Buffer.from(RHOMBUS_SVG).toString("base64")}")`;

export const FONT_FAMILY = "Nunito";
