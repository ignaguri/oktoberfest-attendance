import { useTranslation } from "@prostcounter/shared/i18n";
import type { PersonaCardEntry } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";
import { Pressable, ScrollView } from "react-native";

import { Crest } from "../story/crest";

interface PersonaStripProps {
  cards: PersonaCardEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/** All ten cards as small thumbnails; the selected one has an amber outline. */
export function PersonaStrip({ cards, selectedIndex, onSelect }: PersonaStripProps) {
  const { t } = useTranslation();

  return (
    // A ScrollView grows by default; the album gives that space to the card
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-2 px-4 py-1"
    >
      {cards.map((card, index) => (
        <Pressable
          key={card.personaId}
          onPress={() => onSelect(index)}
          className={cn(
            "h-14 w-10 items-center justify-center rounded border-2 border-wrapped-ink bg-wrapped-paper",
            card.state === "locked" && "border-dashed",
            card.state === "unopened" && "bg-wrapped-ink",
            index === selectedIndex && "border-wrapped-amber",
          )}
          accessibilityRole="button"
          accessibilityLabel={t("wrapped.personas.number", { number: card.number })}
          accessibilityHint={t("wrapped.personas.a11y.thumbnailHint")}
          accessibilityState={{ selected: index === selectedIndex }}
        >
          {card.state === "unopened" ? null : (
            <Crest personaId={card.personaId} size="xs" silhouette={card.state === "locked"} />
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}
