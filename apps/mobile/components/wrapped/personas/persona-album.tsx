import type { EarnedPersona } from "@prostcounter/shared/schemas";
import { useTranslation } from "@prostcounter/shared/i18n";
import { buildPersonaCollection, type PersonaCardEntry, type PersonaId } from "@prostcounter/shared/wrapped";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, useWindowDimensions, View } from "react-native";

import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { PersonaCard } from "./persona-card";
import { PersonaStrip } from "./persona-strip";

const CARD_WIDTH_RATIO = 0.62;

interface PersonaAlbumProps {
  earned: EarnedPersona[];
  onOpen: (personaId: PersonaId) => void;
}

/** Header with progress, a paged featured card, and the thumbnail strip. */
export function PersonaAlbum({ earned, onOpen }: PersonaAlbumProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const collection = useMemo(() => buildPersonaCollection(earned), [earned]);
  const [index, setIndex] = useState(collection.initialIndex);
  const listRef = useRef<FlatList<PersonaCardEntry>>(null);
  const cardWidth = Math.round(screenWidth * CARD_WIDTH_RATIO);
  const progress = (collection.collectedCount / collection.total) * 100;

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(event.nativeEvent.contentOffset.x / screenWidth));
    },
    [screenWidth],
  );

  const onSelect = useCallback((next: number) => {
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }, []);

  return (
    <VStack space="lg" className="py-4">
      <VStack space="xs" className="px-4">
        <Heading size="xl" className="font-wrapped text-wrapped-ink">
          {t("wrapped.personas.title")}
        </Heading>
        <Text className="text-sm font-semibold text-wrapped-ink/75">
          {t("wrapped.personas.progress", { collected: collection.collectedCount, total: collection.total })}
        </Text>
        <View className="h-1.5 overflow-hidden rounded-full bg-wrapped-amber/20">
          <View className="h-full bg-wrapped-amber" style={{ width: `${progress}%` }} />
        </View>
      </VStack>

      <FlatList
        ref={listRef}
        data={collection.cards}
        keyExtractor={(card) => card.personaId}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={collection.initialIndex}
        getItemLayout={(_data, itemIndex) => ({ length: screenWidth, offset: screenWidth * itemIndex, index: itemIndex })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item }) => (
          <View className="items-center py-2" style={{ width: screenWidth }}>
            <PersonaCard card={item} total={collection.total} width={cardWidth} onOpen={onOpen} />
          </View>
        )}
      />

      <PersonaStrip cards={collection.cards} selectedIndex={index} onSelect={onSelect} />
    </VStack>
  );
}
