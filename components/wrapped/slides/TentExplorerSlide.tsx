"use client";

import { getTopTents } from "@/lib/wrapped/utils";
import { motion } from "framer-motion";

import type { WrappedData } from "@/lib/wrapped/types";

import {
  BaseSlide,
  SlideTitle,
  SlideSubtitle,
  SlideContent,
} from "./BaseSlide";

interface TentExplorerSlideProps {
  data: WrappedData;
}

export function TentExplorerSlide({ data }: TentExplorerSlideProps) {
  const { unique_tents, favorite_tent, tent_diversity_pct, tent_breakdown } =
    data.tent_stats;
  const topTents = getTopTents(tent_breakdown, 3);

  return (
    <BaseSlide className="bg-gradient-to-br from-green-50 to-emerald-50">
      <SlideTitle>Tent explorer</SlideTitle>
      <SlideSubtitle>Your favorite spots</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white p-4 shadow text-center">
            <p className="text-3xl font-bold text-yellow-600">{unique_tents}</p>
            <p className="text-sm text-gray-600">Tents visited</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow text-center">
            <p className="text-3xl font-bold text-yellow-600">
              {tent_diversity_pct.toFixed(0)}%
            </p>
            <p className="text-sm text-gray-600">Diversity</p>
          </div>
        </div>

        {favorite_tent && (
          <div className="rounded-lg bg-white p-4 shadow text-center">
            <p className="text-sm text-gray-600 mb-1">Favorite tent</p>
            <p className="text-2xl font-bold text-yellow-600">
              {favorite_tent}
            </p>
          </div>
        )}

        {topTents.length > 0 && (
          <div>
            <h3 className="mb-3 text-center text-lg font-semibold text-gray-700">
              Most visited
            </h3>
            <div className="space-y-2">
              {topTents.map((tent, index) => (
                <motion.div
                  key={`tent-${tent.tent_name}-${index}`}
                  variants={{
                    hidden: { x: -20, opacity: 0 },
                    visible: { x: 0, opacity: 1 },
                  }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center justify-between rounded-lg bg-white p-3 shadow"
                >
                  <span className="font-medium text-gray-700">
                    {tent.tent_name}
                  </span>
                  <span className="text-yellow-600 font-bold">
                    {tent.visit_count}x
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </SlideContent>
    </BaseSlide>
  );
}
