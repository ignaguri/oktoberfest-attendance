"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_CONFIG } from "@/lib/wrapped/config";
import type { WrappedData } from "@/lib/wrapped/types";
import { prepareTimelineData } from "@/lib/wrapped/utils";

import { BaseSlide, SlideSubtitle, SlideTitle } from "./BaseSlide";

interface JourneySlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function JourneySlide({ data, isActive = false }: JourneySlideProps) {
  const timelineData = prepareTimelineData(data.timeline);

  if (timelineData.length === 0) {
    return (
      <BaseSlide
        isActive={isActive}
        className="bg-gradient-to-br from-purple-50 to-pink-50"
      >
        <SlideTitle>Your beer journey</SlideTitle>
        <p className="text-gray-600">No timeline data available</p>
      </BaseSlide>
    );
  }

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-purple-50 to-pink-50"
    >
      <SlideTitle>Your beer journey</SlideTitle>
      <SlideSubtitle>Day by day progression</SlideSubtitle>

      <div className="w-full max-w-3xl">
        <ResponsiveContainer
          width="100%"
          height={CHART_CONFIG.dimensions.height}
        >
          <LineChart
            data={timelineData}
            margin={CHART_CONFIG.dimensions.margin}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_CONFIG.colors.grid}
            />
            <XAxis
              dataKey="date"
              stroke={CHART_CONFIG.colors.text}
              fontSize={12}
            />
            <YAxis stroke={CHART_CONFIG.colors.text} fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px",
              }}
            />
            <Line
              type="monotone"
              dataKey="beers"
              stroke={CHART_CONFIG.colors.primary}
              strokeWidth={3}
              dot={{ fill: CHART_CONFIG.colors.secondary, r: 5 }}
              activeDot={{ r: 7 }}
              name="Beers"
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-6 grid grid-cols-2 gap-4 text-center">
          <div className="rounded-lg bg-white p-3 shadow">
            <p className="text-sm text-gray-600">Peak day</p>
            <p className="text-xl font-bold text-yellow-600">
              {Math.max(...timelineData.map((d) => d.beers))} beers
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow">
            <p className="text-sm text-gray-600">Total days</p>
            <p className="text-xl font-bold text-yellow-600">
              {timelineData.length}
            </p>
          </div>
        </div>
      </div>
    </BaseSlide>
  );
}
