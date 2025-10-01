"use client";

import { getPersonalityDescription } from "@/lib/wrapped/personality";
import { getPersonalityEmoji, getTraitEmoji } from "@/lib/wrapped/utils";
import { motion } from "framer-motion";

import type { WrappedData } from "@/lib/wrapped/types";

import {
  BaseSlide,
  SlideTitle,
  SlideSubtitle,
  SlideContent,
} from "./BaseSlide";

interface PersonalitySlideProps {
  data: WrappedData;
}

export function PersonalitySlide({ data }: PersonalitySlideProps) {
  const { type, traits } = data.personality;
  const description = getPersonalityDescription(type, traits);
  const emoji = getPersonalityEmoji(type);

  return (
    <BaseSlide className="bg-gradient-to-br from-pink-50 to-rose-50">
      <SlideTitle>Your Festival Personality</SlideTitle>
      <SlideSubtitle>Based on your behavior</SlideSubtitle>

      <SlideContent className="space-y-6">
        {/* Personality Type */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-lg"
        >
          <div className="text-7xl">{emoji}</div>
          <h2 className="text-3xl font-bold text-yellow-600">{type}</h2>
          <p className="text-center text-gray-700">{description}</p>
        </motion.div>

        {/* Traits */}
        <div>
          <h3 className="mb-3 text-center text-lg font-semibold text-gray-700">
            Your Traits
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {traits.map((trait, index) => (
              <motion.div
                key={trait}
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  visible: { y: 0, opacity: 1 },
                }}
                transition={{ delay: 0.5 + index * 0.1 }}
                initial="hidden"
                animate="visible"
                className="flex items-center gap-2 rounded-lg bg-white p-3 shadow"
              >
                <span className="text-2xl">{getTraitEmoji(trait)}</span>
                <span className="text-sm font-medium text-gray-700">
                  {trait}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </SlideContent>
    </BaseSlide>
  );
}
