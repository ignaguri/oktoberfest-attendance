import type { EarnedPersona } from "@prostcounter/shared/schemas";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  buildPersonaCollection,
  type PersonaCardEntry,
  type PersonaId,
} from "@prostcounter/shared/wrapped";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { personaCardSize } from "@/lib/wrapped/persona-card-size";

import { PersonaCard } from "./persona-card";
import { PersonaStrip } from "./persona-strip";

/** Room above and below the card for its shadow and the flip's lift */
const CARD_AREA_PADDING = 24;

interface PersonaAlbumProps {
  earned: EarnedPersona[];
  onOpen: (personaId: PersonaId) => void;
}

/** Header with progress, a paged featured card filling the space between, and the thumbnail strip at the bottom. */
export function PersonaAlbum({ earned, onOpen }: PersonaAlbumProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const collection = useMemo(() => buildPersonaCollection(earned), [earned]);
  const [index, setIndex] = useState(collection.initialIndex);
  const listRef = useRef<FlatList<PersonaCardEntry>>(null);
  const insets = useSafeAreaInsets();
  const [areaHeight, setAreaHeight] = useState(0);
  const cardSize = personaCardSize({
    width: screenWidth,
    height: areaHeight - CARD_AREA_PADDING * 2,
  });
  const progress = (collection.collectedCount / collection.total) * 100;

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(event.nativeEvent.contentOffset.x / screenWidth));
    },
    [screenWidth],
  );

  const onAreaLayout = useCallback((event: LayoutChangeEvent) => {
    setAreaHeight(event.nativeEvent.layout.height);
  }, []);

  const onSelect = useCallback((next: number) => {
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }, []);

  return (
    <VStack space="md" className="flex-1 pt-4" style={{ paddingBottom: insets.bottom + 12 }}>
      <VStack space="xs" className="px-4">
        <Heading size="xl" className="font-wrapped text-wrapped-ink">
          {t("wrapped.personas.title")}
        </Heading>
        <Text className="text-sm font-semibold text-wrapped-ink/75">
          {t("wrapped.personas.progress", {
            collected: collection.collectedCount,
            total: collection.total,
          })}
        </Text>
        <View className="h-1.5 overflow-hidden rounded-full bg-wrapped-amber/20">
          <View className="h-full bg-wrapped-amber" style={{ width: `${progress}%` }} />
        </View>
      </VStack>

      <View className="flex-1" onLayout={onAreaLayout}>
        {cardSize ? (
          <FlatList
            ref={listRef}
            data={collection.cards}
            keyExtractor={(card) => card.personaId}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={collection.initialIndex}
            getItemLayout={(_data, itemIndex) => ({
              length: screenWidth,
              offset: screenWidth * itemIndex,
              index: itemIndex,
            })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item }) => (
              <View
                className="items-center justify-center"
                style={{ width: screenWidth, height: areaHeight }}
              >
                <PersonaCard card={item} total={collection.total} size={cardSize} onOpen={onOpen} />
              </View>
            )}
          />
        ) : null}
      </View>

      <PersonaStrip cards={collection.cards} selectedIndex={index} onSelect={onSelect} />
    </VStack>
  );
}
