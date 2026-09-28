import type { WrappedData } from "@prostcounter/shared/wrapped";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import PagerView from "react-native-pager-view";

import { PaginationDots } from "./pagination-dots";
import {
  AchievementsSlide,
  ComparisonsSlide,
  DrinkBreakdownSlide,
  IntroSlide,
  JourneySlide,
  NumbersSlide,
  OutroSlide,
  PeakMomentSlide,
  PersonalitySlide,
  PicturesSlide,
  RankingsSlide,
  SocialSlide,
  TentExplorerSlide,
} from "./slides";

interface WrappedPagerProps {
  data: WrappedData;
  onClose: () => void;
}

export function WrappedPager({ data, onClose }: WrappedPagerProps) {
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Build slide list based on available data
  const slides = useMemo(() => {
    const slideList: {
      key: string;
      render: (isActive: boolean) => React.ReactNode;
    }[] = [];

    // Always include intro
    slideList.push({
      key: "intro",
      render: (isActive) => <IntroSlide data={data} isActive={isActive} />,
    });

    // Always include numbers
    slideList.push({
      key: "numbers",
      render: (isActive) => <NumbersSlide data={data} isActive={isActive} />,
    });

    // Drink breakdown (if consumptions data exists)
    if (data.drinkStats.totalDrinks > 0) {
      slideList.push({
        key: "drink_breakdown",
        render: (isActive) => <DrinkBreakdownSlide data={data} isActive={isActive} />,
      });
    }

    // Always include journey (if timeline data exists)
    if (data.timeline && data.timeline.length > 0) {
      slideList.push({
        key: "journey",
        render: (isActive) => <JourneySlide data={data} isActive={isActive} />,
      });
    }

    // Tent explorer (if tent data exists)
    if (data.tentStats && data.tentStats.uniqueTents > 0) {
      slideList.push({
        key: "tent_explorer",
        render: (isActive) => <TentExplorerSlide data={data} isActive={isActive} />,
      });
    }

    // Peak moment (if best day exists)
    if (data.peakMoments && data.peakMoments.bestDay) {
      slideList.push({
        key: "peak_moment",
        render: (isActive) => <PeakMomentSlide data={data} isActive={isActive} />,
      });
    }

    // Always include social
    slideList.push({
      key: "social",
      render: (isActive) => <SocialSlide data={data} isActive={isActive} />,
    });

    // Pictures (if photos exist)
    if (data.socialStats?.pictures && data.socialStats.pictures.length > 0) {
      slideList.push({
        key: "pictures",
        render: (isActive) => <PicturesSlide data={data} isActive={isActive} />,
      });
    }

    // Achievements (if any unlocked)
    if (data.achievements && data.achievements.length > 0) {
      slideList.push({
        key: "achievements",
        render: (isActive) => <AchievementsSlide data={data} isActive={isActive} />,
      });
    }

    // Always include personality
    if (data.personality) {
      slideList.push({
        key: "personality",
        render: (isActive) => <PersonalitySlide data={data} isActive={isActive} />,
      });
    }

    // Rankings (if top 3 group rankings exist)
    if (data.socialStats?.topRankings && data.socialStats.topRankings.length > 0) {
      slideList.push({
        key: "rankings",
        render: (isActive) => <RankingsSlide data={data} isActive={isActive} />,
      });
    }

    // Comparisons (if comparison data exists)
    if (data.comparisons && data.comparisons.vsLastYear) {
      slideList.push({
        key: "comparisons",
        render: (isActive) => <ComparisonsSlide data={data} isActive={isActive} />,
      });
    }

    // Always include outro
    slideList.push({
      key: "outro",
      render: (isActive) => <OutroSlide data={data} isActive={isActive} onClose={onClose} />,
    });

    return slideList;
  }, [data, onClose]);

  const handlePageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    const position = e.nativeEvent.position;
    setCurrentPage(position);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <View className="flex-1">
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        orientation="horizontal"
        onPageSelected={handlePageSelected}
      >
        {slides.map((slide, index) => (
          <View key={slide.key} style={{ flex: 1 }}>
            {slide.render(index === currentPage)}
          </View>
        ))}
      </PagerView>

      <PaginationDots total={slides.length} current={currentPage} />
    </View>
  );
}
