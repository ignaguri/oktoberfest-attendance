"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { MultiSelect } from "@/components/Select/MultiSelect";
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
  const { tents, isLoading, error } = useTents();

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
      buttonClassName="w-fit self-center"
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
