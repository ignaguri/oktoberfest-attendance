import { useTranslation } from "@prostcounter/shared/i18n";
import {
  type ChartSeries,
  formatChartValue,
  readoutIndex,
  toggleSeries,
  xTickIndices,
} from "@prostcounter/shared/utils";
import { Line as SkiaLine, matchFont, vec } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { Platform } from "react-native";
import { type SharedValue, useAnimatedReaction, useDerivedValue } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { CartesianChart, Line, Scatter, useChartPressState } from "victory-native";
import { scheduleOnRN } from "react-native-worklets";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

import { Chip } from "./chip";

/** Short series get a dot on every point so a handful of values still reads. */
const DOTS_MAX_POINTS = 12;
const AXIS_FONT = matchFont({
  fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }),
  fontSize: 11,
});

/** Victory's generics cannot resolve a generic key type, so the canvas works on string keys. */
type CanvasPoint = { index: number; [seriesKey: string]: number | null };

type ChartRow<K extends string> = { x: string } & Record<K, number | null>;

export interface LineChartProps<K extends string> {
  rows: readonly ChartRow<K>[];
  /** All series must share one format; the y axis follows the first. */
  series: readonly ChartSeries<K>[];
  /** Axis label for a row's x. */
  formatXTick: (x: string) => string;
  /** Readout label for a row's x; defaults to formatXTick. */
  formatXLabel?: (x: string) => string;
  /** Readout value; defaults to formatChartValue with the series format. */
  formatValue?: (rowIndex: number, key: K) => string;
  maxXTicks?: number;
}

export function LineChart<K extends string>({
  rows,
  series,
  formatXTick,
  formatXLabel = formatXTick,
  formatValue,
  maxXTicks = 5,
}: LineChartProps<K>) {
  const { t } = useTranslation();
  const allKeys = series.map((line) => line.key);
  const [visibleKeys, setVisibleKeys] = useState<K[]>(allKeys);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  // Stable across press re-renders: Victory resets the press whenever its data changes identity.
  const visibleSeries = useMemo(
    () => series.filter((line) => visibleKeys.includes(line.key)),
    [series, visibleKeys],
  );

  const shownIndex = readoutIndex(rows.length, pressedIndex);
  if (shownIndex === null) {
    return null;
  }
  const shownRow = rows[shownIndex];

  const valueText = (key: K) => {
    if (formatValue) {
      return formatValue(shownIndex, key);
    }
    const line = series.find((candidate) => candidate.key === key);
    return formatChartValue(shownRow?.[key] ?? null, line?.format ?? "count");
  };

  const readoutSummary = [
    formatXLabel(shownRow?.x ?? ""),
    ...visibleSeries.map((line) => `${t(line.labelKey)} ${valueText(line.key)}`),
  ].join(", ");

  return (
    <VStack space="sm">
      <HStack space="md" className="flex-wrap items-center">
        <Text className="text-sm font-semibold text-typography-900">
          {formatXLabel(shownRow?.x ?? "")}
        </Text>
        {visibleSeries.map((line) => (
          <HStack key={line.key} space="xs" className="items-center">
            <Svg width={8} height={8}>
              <Circle cx={4} cy={4} r={4} fill={line.color} />
            </Svg>
            <Text className="text-sm text-typography-700">{valueText(line.key)}</Text>
          </HStack>
        ))}
      </HStack>
      <View
        className="h-56 w-full"
        accessible
        accessibilityLabel={readoutSummary}
        accessibilityHint={t("admin.analytics.chart.scrubHint")}
      >
        <ChartCanvas
          key={visibleKeys.join(",")}
          rows={rows}
          series={visibleSeries}
          formatXTick={formatXTick}
          maxXTicks={maxXTicks}
          onPressedIndexChange={setPressedIndex}
        />
      </View>
      <HStack space="sm" className="flex-wrap">
        {series.map((line) => (
          <Chip
            key={line.key}
            label={t(line.labelKey)}
            selected={visibleKeys.includes(line.key)}
            color={line.color}
            onPress={() => setVisibleKeys(toggleSeries(visibleKeys, line.key, allKeys))}
            accessibilityHint={t("admin.analytics.chart.toggleHint")}
          />
        ))}
      </HStack>
    </VStack>
  );
}

interface ChartCanvasProps<K extends string> {
  rows: readonly ChartRow<K>[];
  series: readonly ChartSeries<K>[];
  formatXTick: (x: string) => string;
  maxXTicks: number;
  onPressedIndexChange: (index: number | null) => void;
}

/** Keyed by the visible series, so a toggle remounts it with a fresh press state. */
function ChartCanvas<K extends string>({
  rows,
  series,
  formatXTick,
  maxXTicks,
  onPressedIndexChange,
}: ChartCanvasProps<K>) {
  const keys: string[] = series.map((line) => line.key);
  const format = series[0]?.format ?? "count";
  const isPercent = format === "percent";
  // Memoized: CartesianChart resets its press state whenever `data` changes identity.
  const data = useMemo(
    (): CanvasPoint[] =>
      rows.map((row, index) => ({
        ...Object.fromEntries(series.map((line) => [line.key, row[line.key]])),
        index,
      })),
    [rows, series],
  );
  const initialY = Object.fromEntries(keys.map((key) => [key, 0])) as Record<string, number>;
  // A count axis with no positive value would collapse to a zero-height scale.
  const hasPositiveValue = data.some((point) => keys.some((key) => (point[key] ?? 0) > 0));
  const yDomain: [number] | [number, number] = isPercent || !hasPositiveValue ? [0, 1] : [0];
  const { state, isActive } = useChartPressState({ x: 0, y: initialY });

  useAnimatedReaction(
    () => (isActive ? state.matchedIndex.value : -1),
    (matchedIndex) => {
      scheduleOnRN(onPressedIndexChange, matchedIndex < 0 ? null : matchedIndex);
    },
    [isActive],
  );

  return (
    <CartesianChart
      data={data}
      xKey="index"
      yKeys={keys}
      chartPressState={state}
      domainPadding={{ left: 12, right: 12, top: 8 }}
      xAxis={{
        font: AXIS_FONT,
        tickValues: xTickIndices(rows.length, maxXTicks),
        formatXLabel: (index) => formatXTick(rows[Math.round(Number(index))]?.x ?? ""),
        labelColor: Colors.gray[500],
        lineColor: Colors.gray[200],
      }}
      yAxis={[
        {
          font: AXIS_FONT,
          tickCount: 4,
          domain: yDomain,
          formatYLabel: (value) => formatChartValue(Number(value), format),
          labelColor: Colors.gray[500],
          lineColor: Colors.gray[200],
        },
      ]}
    >
      {({ points, chartBounds }) => (
        <>
          {series.map((line) => (
            <Line
              key={line.key}
              points={points[line.key]}
              color={line.color}
              strokeWidth={2}
              connectMissingData={false}
            />
          ))}
          {rows.length <= DOTS_MAX_POINTS &&
            series.map((line) => (
              <Scatter
                key={`${line.key}-dots`}
                points={points[line.key]}
                radius={3}
                color={line.color}
              />
            ))}
          {isActive && (
            <Crosshair x={state.x.position} top={chartBounds.top} bottom={chartBounds.bottom} />
          )}
        </>
      )}
    </CartesianChart>
  );
}

function Crosshair({ x, top, bottom }: { x: SharedValue<number>; top: number; bottom: number }) {
  const start = useDerivedValue(() => vec(x.value, top));
  const end = useDerivedValue(() => vec(x.value, bottom));
  return <SkiaLine p1={start} p2={end} color={Colors.gray[400]} strokeWidth={1} />;
}
