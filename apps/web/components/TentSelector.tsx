"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { MultiSelect } from "@/components/Select/MultiSelect";
import { useFestival } from "@/contexts/FestivalContext";
import { useTents } from "@/hooks/use-tents";

interface TentSelectorProps {
  selectedTents: string[];
  onTentsChange: (tents: string[]) => void;
  disabled?: boolean;
}

export default function TentSelector({
  selectedTents,
  onTentsChange,
  disabled = false,
}: TentSelectorProps) {
  const { currentFestival } = useFestival();
  const { tents, isLoading, error } = useTents(currentFestival?.id);

  const handleSelect = (option: { value: string; label: string }) => {
    onTentsChange([...selectedTents, option.value]);
  };

  const handleUnselect = (option: { value: string; label: string }) => {
    onTentsChange(selectedTents.filter((id) => id !== option.value));
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <MultiSelect
      className="w-full self-center"
      buttonClassName="w-4/5"
      options={tents.map((tent) => ({
        title: tent.category,
        options: tent.options,
      }))}
      placeholder="Select tents"
      onSelect={handleSelect}
      onUnselect={handleUnselect}
      value={selectedTents}
      disabled={disabled}
    />
  );
}
