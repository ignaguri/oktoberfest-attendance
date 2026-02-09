import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import {
  getBestGlobalPosition,
  prepareShareImageData,
} from "@prostcounter/shared/wrapped";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { Colors } from "@/lib/constants/colors";

interface ShareImageProps {
  data: WrappedData;
}

/**
 * Off-screen share image rendered at Instagram Story aspect ratio (9:16).
 * Captured via react-native-view-shot for sharing.
 * Uses React Native Text directly (not Gluestack) with explicit lineHeight for reliable capture.
 */
export function ShareImage({ data }: ShareImageProps) {
  const { t } = useTranslation();
  const shareData = useMemo(() => prepareShareImageData(data), [data]);
  const bestGlobal = useMemo(() => getBestGlobalPosition(data), [data]);

  return (
    <View style={{ width: 360, height: 640 }} className="bg-yellow-100">
      {/* Header */}
      <View
        className="items-center bg-yellow-500 px-6"
        style={{ paddingTop: 48, paddingBottom: 28 }}
      >
        <Text
          className="text-sm font-semibold"
          style={{ lineHeight: 20, color: "rgba(255,255,255,0.8)" }}
        >
          {t("wrapped.shareImage.title")}
        </Text>
        <Text
          className="mt-1.5 text-center text-xl font-bold text-white"
          style={{ lineHeight: 30 }}
        >
          {shareData.festivalName}
        </Text>
      </View>

      {/* Stats grid */}
      <View className="flex-1 px-5 pt-5">
        <View className="mb-3 flex-row gap-3">
          <StatCard
            label={t("wrapped.shareImage.daysAttended")}
            value={String(shareData.daysAttended)}
            emoji={"\u{1F4C5}"}
          />
          <StatCard
            label={t("wrapped.shareImage.beersDrunk")}
            value={String(shareData.beersDrunk)}
            emoji={"\u{1F37A}"}
          />
        </View>
        <View className="mb-3 flex-row gap-3">
          <StatCard
            label={t("wrapped.shareImage.tentsVisited")}
            value={String(shareData.tentsVisited)}
            emoji={"\u{1F3AA}"}
          />
          <StatCard
            label={t("wrapped.shareImage.podiumFinishes")}
            value={String(shareData.podiumGroupsCount)}
            emoji={"\u{1F3C6}"}
          />
        </View>

        {/* Best global rank */}
        {bestGlobal && (
          <View className="mb-3 items-center rounded-2xl bg-white p-4">
            <Text className="text-xs text-gray-500" style={{ lineHeight: 18 }}>
              {t("wrapped.shareImage.bestGlobalRank")}
            </Text>
            <Text
              className="mt-1 text-3xl font-bold"
              style={{ lineHeight: 38, color: Colors.primary[500] }}
            >
              #{bestGlobal.position}
            </Text>
            <Text
              className="mt-0.5 text-xs text-gray-400"
              style={{ lineHeight: 16 }}
            >
              {t(
                `wrapped.shareImage.criteriaLabels.${bestGlobal.criteria}` as const,
              )}
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View className="items-center px-6" style={{ paddingBottom: 36 }}>
        <Text
          className="text-base font-bold"
          style={{ lineHeight: 22, color: Colors.primary[600] }}
        >
          ProstCounter
        </Text>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  emoji,
}: {
  label: string;
  value: string;
  emoji: string;
}) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4">
      <Text className="text-xl" style={{ lineHeight: 32 }}>
        {emoji}
      </Text>
      <Text
        className="mt-1 text-2xl font-bold text-gray-800"
        style={{ lineHeight: 36 }}
      >
        {value}
      </Text>
      <Text className="mt-1 text-xs text-gray-500" style={{ lineHeight: 16 }}>
        {label}
      </Text>
    </View>
  );
}
