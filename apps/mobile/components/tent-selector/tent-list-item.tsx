import type { CrowdLevel } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { Check } from "lucide-react-native";

import { CrowdLevelBadge } from "@/components/crowd/crowd-level-badge";
import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
} from "@/components/ui/checkbox";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface TentListItemProps {
  tentId: string;
  tentName: string;
  isSelected: boolean;
  onToggle: (tentId: string) => void;
  mode: "single" | "multi";
  crowdLevel?: CrowdLevel | null;
  avgWaitMinutes?: number | null;
}

export function TentListItem({
  tentId,
  tentName,
  isSelected,
  onToggle,
  mode,
  crowdLevel,
  avgWaitMinutes,
}: TentListItemProps) {
  const handlePress = () => {
    onToggle(tentId);
  };

  if (mode === "multi") {
    return (
      <Checkbox
        value={tentId}
        isChecked={isSelected}
        onChange={handlePress}
        size="md"
        className="px-4 py-3"
      >
        <CheckboxIndicator>
          <CheckboxIcon as={Check} color={IconColors.white} />
        </CheckboxIndicator>
        <VStack className="flex-1">
          <CheckboxLabel>{tentName}</CheckboxLabel>
          {crowdLevel && <CrowdLevelBadge crowdLevel={crowdLevel} compact />}
        </VStack>
      </Checkbox>
    );
  }

  // Single select mode - highlight style
  return (
    <Pressable
      onPress={handlePress}
      className={cn("px-4 py-3", isSelected && "bg-primary-100")}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
    >
      <HStack className="items-center justify-between">
        <VStack className="flex-1">
          <Text
            className={cn(
              isSelected
                ? "font-semibold text-primary-700"
                : "text-typography-700",
            )}
          >
            {tentName}
          </Text>
          {crowdLevel && (
            <CrowdLevelBadge
              crowdLevel={crowdLevel}
              avgWaitMinutes={avgWaitMinutes}
            />
          )}
        </VStack>
        {isSelected && <Check size={20} color={IconColors.default} />}
      </HStack>
    </Pressable>
  );
}

TentListItem.displayName = "TentListItem";
