import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react-native";

import { Input, InputField, InputSlot } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { IconColors } from "@/lib/constants/colors";

interface TentSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/**
 * Search input for filtering tents
 *
 * Features:
 * - Search icon on the left
 * - Debounced search (300ms)
 * - Clear button when has value
 */
export function TentSearchInput({
  value,
  onChangeText,
  placeholder = "Search tents...",
}: TentSearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced callback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChangeText(localValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, value, onChangeText]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChangeText("");
  }, [onChangeText]);

  return (
    <Input variant="outline" size="md" className="bg-background-0">
      <InputSlot className="pl-3">
        <Search size={18} color={IconColors.muted} />
      </InputSlot>
      <InputField
        placeholder={placeholder}
        value={localValue}
        onChangeText={setLocalValue}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {localValue.length > 0 && (
        <InputSlot className="pr-3">
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={IconColors.muted} />
          </Pressable>
        </InputSlot>
      )}
    </Input>
  );
}

TentSearchInput.displayName = "TentSearchInput";
