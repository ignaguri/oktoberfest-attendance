import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import {
  getPersonalityEmoji,
  getTraitEmoji,
} from "@prostcounter/shared/wrapped";
import { useMemo } from "react";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BaseSlide, SlideSubtitle, SlideTitle } from "./base-slide";

interface PersonalitySlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function PersonalitySlide({ data, isActive }: PersonalitySlideProps) {
  const { t } = useTranslation();

  const personalityType = data.personality.type;
  const traits = data.personality.traits;
  const emoji = useMemo(
    () => getPersonalityEmoji(personalityType),
    [personalityType],
  );

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-pink-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.personalitySlide.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.personalitySlide.subtitle")}
        </SlideSubtitle>

        {/* Personality type card */}
        <Motion.View
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: isActive ? 1 : 0,
            opacity: isActive ? 1 : 0,
          }}
          transition={{
            type: "spring",
            damping: 12,
            stiffness: 100,
            delay: 200,
          }}
          className="items-center rounded-2xl bg-white/70 p-6"
        >
          <Text className="text-6xl">{emoji}</Text>
          <Text className="mt-3 text-xl font-bold text-gray-800">
            {t(`wrapped.personalityTypes.${personalityType}`, {
              defaultValue: personalityType,
            })}
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-600">
            {t(`wrapped.personalityDescriptions.${personalityType}`, {
              defaultValue: personalityType,
            })}
          </Text>
        </Motion.View>

        {/* Traits grid */}
        {traits.length > 0 && (
          <VStack space="sm">
            <Motion.View
              initial={{ opacity: 0 }}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ type: "timing", duration: 300, delay: 500 }}
            >
              <Text className="text-center text-sm font-semibold text-gray-600">
                {t("wrapped.personalitySlide.traits")}
              </Text>
            </Motion.View>

            <View className="flex-row flex-wrap justify-center gap-2">
              {traits
                .filter((trait) => trait && trait.trim())
                .slice(0, 4)
                .map((trait, index) => (
                  <Motion.View
                    key={trait}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: isActive ? 1 : 0,
                      opacity: isActive ? 1 : 0,
                    }}
                    transition={{
                      type: "spring",
                      damping: 12,
                      stiffness: 120,
                      delay: 600 + index * 100,
                    }}
                    className="rounded-xl bg-white/60 px-4 py-2"
                  >
                    <HStack space="xs" className="items-center">
                      <Text className="text-lg">{getTraitEmoji(trait)}</Text>
                      <Text className="text-sm text-gray-700">
                        {t(`wrapped.personalityTraits.${trait}`, {
                          defaultValue: trait,
                        })}
                      </Text>
                    </HStack>
                  </Motion.View>
                ))}
            </View>
          </VStack>
        )}
      </VStack>
    </BaseSlide>
  );
}
