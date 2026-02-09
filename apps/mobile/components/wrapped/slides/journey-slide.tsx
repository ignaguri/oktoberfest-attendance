import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import {
  CHART_CONFIG,
  prepareTimelineData,
} from "@prostcounter/shared/wrapped";
import { useMemo } from "react";
import { Dimensions } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { VStack } from "@/components/ui/vstack";

import { BaseSlide, SlideSubtitle, SlideTitle } from "./base-slide";

interface JourneySlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function JourneySlide({ data, isActive }: JourneySlideProps) {
  const { t } = useTranslation();
  const screenWidth = Dimensions.get("window").width;

  const timelineData = useMemo(
    () => prepareTimelineData(data.timeline),
    [data.timeline],
  );

  const chartWidth = screenWidth - 72; // 24px padding on each side + 24 extra
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 30 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const maxBeers = Math.max(...timelineData.map((d) => d.beers), 1);

  // Build SVG path
  const points = timelineData.map((d, i) => ({
    x: padding.left + (i / Math.max(timelineData.length - 1, 1)) * plotWidth,
    y: padding.top + plotHeight - (d.beers / maxBeers) * plotHeight,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-indigo-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.journey.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.journey.subtitle")}
        </SlideSubtitle>

        <Motion.View
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: isActive ? 1 : 0,
            scale: isActive ? 1 : 0.9,
          }}
          transition={{ type: "timing", duration: 600, delay: 300 }}
          className="mt-4 items-center rounded-2xl bg-white/70 p-4"
        >
          <Svg width={chartWidth} height={chartHeight}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <Line
                key={ratio}
                x1={padding.left}
                y1={padding.top + plotHeight * (1 - ratio)}
                x2={padding.left + plotWidth}
                y2={padding.top + plotHeight * (1 - ratio)}
                stroke={CHART_CONFIG.colors.grid}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            ))}

            {/* Y-axis labels */}
            {[0, 0.5, 1].map((ratio) => (
              <SvgText
                key={`y-${ratio}`}
                x={padding.left - 8}
                y={padding.top + plotHeight * (1 - ratio) + 4}
                fontSize={10}
                fill={CHART_CONFIG.colors.text}
                textAnchor="end"
              >
                {Math.round(maxBeers * ratio)}
              </SvgText>
            ))}

            {/* Line path */}
            <Path
              d={pathD}
              stroke={CHART_CONFIG.colors.primary}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={4}
                fill={CHART_CONFIG.colors.primary}
                stroke="white"
                strokeWidth={2}
              />
            ))}

            {/* X-axis labels (show first, middle, last) */}
            {timelineData.length > 0 && (
              <>
                <SvgText
                  x={points[0]?.x ?? 0}
                  y={chartHeight - 8}
                  fontSize={9}
                  fill={CHART_CONFIG.colors.text}
                  textAnchor="start"
                >
                  {timelineData[0].date}
                </SvgText>
                {timelineData.length > 2 && (
                  <SvgText
                    x={points[points.length - 1]?.x ?? 0}
                    y={chartHeight - 8}
                    fontSize={9}
                    fill={CHART_CONFIG.colors.text}
                    textAnchor="end"
                  >
                    {timelineData[timelineData.length - 1].date}
                  </SvgText>
                )}
              </>
            )}
          </Svg>
        </Motion.View>
      </VStack>
    </BaseSlide>
  );
}
