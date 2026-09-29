import type {
  CityShareCard,
  NumbersShareCard,
  PersonaShareCard,
  PhotosShareCard,
  RhythmShareCard,
  ShareCard,
  StatCard,
} from "@prostcounter/shared/wrapped/server";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { CardTranslate } from "./translate";
import { CARD_SIZE, COLORS, FONT_FAMILY, OG_SIZE, PATTERN } from "./theme";

export interface LayoutContext {
  t: CardTranslate;
  formatNumber: (value: number) => string;
  formatDate: (isoDate: string) => string;
  crestDataUrl: string | null;
  photoDataUrls: string[];
}

const MAX_COLUMN_DOTS = 12;
const MAX_TENT_ICONS = 3;
/** Light festivals still get a track; taller than the story's 4, the card has the room. */
const MIN_TRACK_DOTS = 6;
const CHART_WIDTH = 920;

const column: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};
const text = (style: CSSProperties): CSSProperties => ({
  display: "flex",
  textAlign: "center",
  ...style,
});

function Brand(): ReactElement {
  return (
    <div
      style={text({
        marginTop: "auto",
        backgroundColor: COLORS.amber,
        color: COLORS.ink,
        fontWeight: 900,
        fontSize: 40,
        letterSpacing: 6,
        padding: "18px 44px",
        borderRadius: 999,
        border: `4px solid ${COLORS.ink}`,
        transform: "rotate(-2deg)",
      })}
    >
      PROSTCOUNTER
    </div>
  );
}

function Page({
  kicker,
  children,
}: {
  kicker: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      style={{
        ...column,
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        backgroundColor: COLORS.paper,
        backgroundImage: PATTERN,
        backgroundSize: "60px 60px",
        backgroundRepeat: "repeat",
        fontFamily: FONT_FAMILY,
        color: COLORS.ink,
        padding: "120px 80px",
      }}
    >
      <div
        style={text({
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.8,
        })}
      >
        {kicker}
      </div>
      {children}
      <Brand />
    </div>
  );
}

function Sticker({
  children,
  rotate,
  style,
}: {
  children: ReactNode;
  rotate: number;
  style?: CSSProperties;
}): ReactElement {
  return (
    <div
      style={text({
        backgroundColor: COLORS.white,
        border: `4px solid ${COLORS.ink}`,
        borderRadius: 20,
        padding: "20px 36px",
        fontSize: 48,
        fontWeight: 800,
        maxWidth: 900,
        transform: `rotate(${rotate}deg)`,
        ...style,
      })}
    >
      {children}
    </div>
  );
}

function NavyStat({
  stat,
  t,
  rotate,
}: {
  stat: StatCard;
  t: CardTranslate;
  rotate: number;
}): ReactElement {
  return (
    <div
      style={{
        ...column,
        width: 900,
        marginTop: 48,
        backgroundColor: COLORS.ink,
        color: COLORS.paper,
        borderRadius: 32,
        padding: "36px 40px",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        style={text({
          fontSize: 110,
          fontWeight: 900,
          color: COLORS.amber,
          lineHeight: 1,
        })}
      >
        {t(stat.stat)}
      </div>
      <div style={text({ fontSize: 44, fontWeight: 800, marginTop: 12 })}>
        {t(stat.caption)}
      </div>
    </div>
  );
}

function TentIcon({ size }: { size: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.ink}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 21 14 3" />
      <path d="M20.5 21 10 3" />
      <path d="M15.5 21 12 15l-3.5 6" />
      <path d="M2 21h20" />
    </svg>
  );
}

function NumbersLayout({
  card,
  context,
}: {
  card: NumbersShareCard;
  context: LayoutContext;
}): ReactElement {
  const { t } = context;
  return (
    <Page kicker={t(card.kicker)}>
      <div
        style={text({
          fontSize: 360,
          fontWeight: 900,
          lineHeight: 1,
          marginTop: 120,
        })}
      >
        {context.formatNumber(card.value)}
      </div>
      <div style={text({ fontSize: 96, fontWeight: 900 })}>{t(card.unit)}</div>
      {card.comparison ? (
        <div
          style={text({
            fontSize: 48,
            fontWeight: 800,
            marginTop: 24,
            maxWidth: 880,
            opacity: 0.85,
          })}
        >
          {t(card.comparison)}
        </div>
      ) : null}
      <div style={{ display: "flex", marginTop: 100 }}>
        {card.boxes.map((box, index) => (
          <div
            key={box.caption.key}
            style={{
              ...column,
              width: 380,
              margin: "0 20px",
              backgroundColor: COLORS.ink,
              color: COLORS.paper,
              borderRadius: 32,
              padding: "36px 24px",
              transform: `rotate(${index % 2 === 0 ? -2 : 2}deg)`,
            }}
          >
            <div
              style={text({
                fontSize: 120,
                fontWeight: 900,
                color: COLORS.amber,
                lineHeight: 1,
              })}
            >
              {t(box.stat)}
            </div>
            <div style={text({ fontSize: 48, fontWeight: 800 })}>
              {t(box.caption)}
            </div>
          </div>
        ))}
      </div>
      {card.homeTent ? (
        <Sticker rotate={-2} style={{ marginTop: 60 }}>
          {t(card.homeTent)}
        </Sticker>
      ) : null}
    </Page>
  );
}

/** Keeps even "Einmal, aber richtig" on one line inside the name box. */
export function personaNameFontSize(name: string): number {
  return Math.max(60, Math.min(110, Math.floor(1350 / name.length)));
}

function PersonaLayout({
  card,
  context,
}: {
  card: PersonaShareCard;
  context: LayoutContext;
}): ReactElement {
  const { t } = context;
  return (
    <Page kicker={t(card.kicker)}>
      <div style={{ ...column, flex: 1, justifyContent: "center" }}>
        {context.crestDataUrl ? (
          <img
            src={context.crestDataUrl}
            width={620}
            height={620}
            style={{ transform: "rotate(-3deg)" }}
          />
        ) : null}
        <div
          style={text({
            fontSize: personaNameFontSize(card.name),
            fontWeight: 900,
            lineHeight: 1.15,
            maxWidth: 920,
            marginTop: 10,
            backgroundColor: COLORS.amber,
            padding: "10px 40px",
            borderRadius: 24,
            border: `6px solid ${COLORS.ink}`,
            transform: "rotate(2deg)",
          })}
        >
          {card.name}
        </div>
        <div
          style={text({
            fontSize: 50,
            fontWeight: 800,
            marginTop: 30,
            maxWidth: 860,
          })}
        >
          {t(card.description)}
        </div>
        <div
          style={{
            ...column,
            width: 860,
            marginTop: 40,
            backgroundColor: COLORS.ink,
            color: COLORS.amber,
            borderRadius: 32,
            padding: "28px 48px",
            transform: "rotate(-1deg)",
          }}
        >
          {card.facts.map((fact) => (
            <div
              key={fact.key}
              style={text({ fontSize: 60, fontWeight: 900, padding: "8px 0" })}
            >
              {t(fact)}
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

/** Column, dot and tent sizes for one bar per festival day, within CHART_WIDTH. */
export function rhythmSizing(barCount: number) {
  const columnWidth = Math.floor(CHART_WIDTH / Math.max(barCount, 1));
  // Past ~38 days the columns get narrow, so the gap and outline thin out first
  const isNarrow = columnWidth < 24;
  const gap = isNarrow ? 4 : 6;
  const border = isNarrow ? 1 : 3;
  const inner = columnWidth - gap - 2 * border;
  return {
    columnWidth,
    gap,
    border,
    dot: Math.max(2, Math.min(44, inner - 2)),
    tentSize: Math.min(
      Math.max(12, Math.min(30, columnWidth - 12)),
      columnWidth - gap,
    ),
  };
}

function RhythmLayout({
  card,
  context,
}: {
  card: RhythmShareCard;
  context: LayoutContext;
}): ReactElement {
  const { t } = context;
  const { columnWidth, gap, border, dot, tentSize } = rhythmSizing(
    card.bars.length,
  );
  // As on the story slide: a faint track as tall as the biggest day, on every day
  const trackDots = Math.min(
    Math.max(...card.bars.map((bar) => Math.round(bar.beers)), MIN_TRACK_DOTS),
    MAX_COLUMN_DOTS,
  );
  const hasBeerOverflow = card.bars.some(
    (bar) => Math.round(bar.beers) > MAX_COLUMN_DOTS,
  );
  const tentRows = Math.min(
    Math.max(0, ...card.bars.map((bar) => bar.tents)),
    MAX_TENT_ICONS,
  );
  const firstDate = card.bars[0]?.date;
  const lastDate = card.bars[card.bars.length - 1]?.date;
  return (
    <Page kicker={t(card.kicker)}>
      <div
        style={text({
          fontSize: 88,
          fontWeight: 900,
          marginTop: 40,
          maxWidth: 900,
        })}
      >
        {t(card.title)}
      </div>
      <div style={{ ...column, flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          {card.bars.map((bar) => {
            const isBest = card.bestDay?.date === bar.date;
            const color = isBest ? COLORS.amber : COLORS.ink;
            const filled = Math.min(
              Math.max(bar.beers > 0 ? 1 : 0, Math.round(bar.beers)),
              trackDots,
            );
            return (
              <div key={bar.date} style={{ ...column, width: columnWidth }}>
                <div
                  style={{
                    ...column,
                    justifyContent: "flex-end",
                    width: columnWidth - gap,
                    borderRadius: 12,
                    border: `${border}px solid ${bar.attended ? COLORS.inkFaint : "transparent"}`,
                    padding: "6px 0",
                  }}
                >
                  {hasBeerOverflow ? (
                    <div
                      style={text({
                        fontSize: dot,
                        fontWeight: 900,
                        color,
                        height: dot,
                        lineHeight: 1,
                      })}
                    >
                      {Math.round(bar.beers) > MAX_COLUMN_DOTS ? "+" : ""}
                    </div>
                  ) : null}
                  {Array.from({ length: trackDots }, (_, index) => (
                    <div
                      key={index}
                      style={{
                        width: dot,
                        height: dot,
                        borderRadius: dot / 2,
                        backgroundColor:
                          trackDots - index > filled ? COLORS.inkTrack : color,
                        marginTop: index === 0 && !hasBeerOverflow ? 0 : 6,
                      }}
                    />
                  ))}
                </div>
                {tentRows > 0 ? (
                  <div
                    style={{
                      ...column,
                      height: tentRows * (tentSize + 4) + 8,
                      marginTop: 10,
                    }}
                  >
                    {Array.from(
                      { length: Math.min(bar.tents, MAX_TENT_ICONS) },
                      (_, index) => (
                        <TentIcon key={index} size={tentSize} />
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {firstDate && lastDate ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: columnWidth * card.bars.length,
              marginTop: 16,
              fontSize: 36,
              fontWeight: 800,
              color: COLORS.inkFaint,
            }}
          >
            <div style={{ display: "flex" }}>
              {context.formatDate(firstDate)}
            </div>
            <div style={{ display: "flex" }}>
              {context.formatDate(lastDate)}
            </div>
          </div>
        ) : null}
        {card.bestDay ? (
          <Sticker rotate={-1} style={{ marginTop: 70 }}>
            {`${t({ key: "wrapped.shareCards.rhythm.best", params: { date: context.formatDate(card.bestDay.date) } })} · ${t(card.bestDay.beers)}`}
          </Sticker>
        ) : null}
      </div>
    </Page>
  );
}

function CityLayout({
  card,
  context,
}: {
  card: CityShareCard;
  context: LayoutContext;
}): ReactElement {
  const { t } = context;
  return (
    <Page kicker={t(card.kicker)}>
      <div
        style={text({
          fontSize: 72,
          fontWeight: 900,
          marginTop: 40,
          maxWidth: 900,
        })}
      >
        {t(card.title)}
      </div>
      {card.visitors ? (
        <NavyStat stat={card.visitors} t={t} rotate={-2} />
      ) : null}
      {card.share ? <NavyStat stat={card.share} t={t} rotate={2} /> : null}
      {card.mugs ? (
        <div
          style={{
            ...column,
            marginTop: 56,
            backgroundColor: COLORS.amber,
            border: `4px solid ${COLORS.ink}`,
            borderRadius: 24,
            padding: "24px 40px",
            transform: "rotate(3deg)",
          }}
        >
          <div style={text({ fontSize: 80, fontWeight: 900, lineHeight: 1 })}>
            {t(card.mugs.stat)}
          </div>
          <div style={text({ fontSize: 40, fontWeight: 800, marginTop: 8 })}>
            {t(card.mugs.caption)}
          </div>
        </div>
      ) : null}
      <div
        style={text({
          fontSize: 30,
          fontWeight: 800,
          marginTop: 48,
          opacity: 0.7,
          maxWidth: 900,
        })}
      >
        {t(card.source)}
      </div>
    </Page>
  );
}

const PHOTO_TILTS = [0, 3, -2, 0];

function PhotosLayout({
  card,
  context,
}: {
  card: PhotosShareCard;
  context: LayoutContext;
}): ReactElement {
  const { t } = context;
  const line = [card.groups, card.bestPlacing]
    .filter((ref) => ref !== null)
    .map((ref) => t(ref))
    .join(" · ");
  return (
    <Page kicker={t(card.kicker)}>
      <div
        style={text({
          fontSize: 110,
          fontWeight: 900,
          marginTop: 10,
          transform: "rotate(-2deg)",
        })}
      >
        {t(card.title)}
      </div>
      {context.photoDataUrls.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: 920,
            justifyContent: "center",
            marginTop: 60,
          }}
        >
          {context.photoDataUrls.map((url, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                width: 420,
                height: 420,
                margin: 20,
                backgroundColor: COLORS.white,
                border: `8px solid ${COLORS.ink}`,
                borderRadius: 24,
                padding: 10,
                transform: `rotate(${PHOTO_TILTS[index % PHOTO_TILTS.length]}deg)`,
              }}
            >
              <img
                src={url}
                width={384}
                height={384}
                style={{ objectFit: "cover", borderRadius: 14 }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {line ? (
        <Sticker rotate={1} style={{ marginTop: 60 }}>
          {line}
        </Sticker>
      ) : null}
    </Page>
  );
}

export function storyLayout(
  card: ShareCard,
  context: LayoutContext,
): ReactElement {
  switch (card.kind) {
    case "numbers":
      return <NumbersLayout card={card} context={context} />;
    case "persona":
      return <PersonaLayout card={card} context={context} />;
    case "rhythm":
      return <RhythmLayout card={card} context={context} />;
    case "city":
      return <CityLayout card={card} context={context} />;
    case "photos":
      return <PhotosLayout card={card} context={context} />;
  }
}

/** The link preview: the story card, small and tilted, next to the title. */
export function ogLayout(
  storyDataUrl: string,
  title: string,
  tagline: string,
): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        backgroundColor: COLORS.paper,
        backgroundImage: PATTERN,
        backgroundSize: "60px 60px",
        backgroundRepeat: "repeat",
        fontFamily: FONT_FAMILY,
        color: COLORS.ink,
        padding: "0 80px",
      }}
    >
      <img
        src={storyDataUrl}
        width={300}
        height={533}
        style={{
          borderRadius: 20,
          border: `6px solid ${COLORS.ink}`,
          transform: "rotate(-3deg)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: 70,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 800,
            marginTop: 24,
            opacity: 0.8,
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            marginTop: 40,
            backgroundColor: COLORS.amber,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 5,
            padding: "14px 34px",
            borderRadius: 999,
            border: `4px solid ${COLORS.ink}`,
            transform: "rotate(-2deg)",
          }}
        >
          PROSTCOUNTER
        </div>
      </div>
    </div>
  );
}
