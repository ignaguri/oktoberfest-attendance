"use client";

import type {
  ComboboxOption,
  ComboboxOptionGroup,
} from "@/components/ui/combobox";
import { Combobox } from "@/components/ui/combobox";

interface SingleSelectProps {
  id?: string;
  buttonClassName?: string;
  className?: string;
  options: ComboboxOptionGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  errorMsg?: string;
  onSelect?: (option: ComboboxOption) => void;
  onUnselect?: () => void;
  value?: string | null;
}

export function SingleSelect({
  id,
  buttonClassName,
  className,
  disabled,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onSelect,
  onUnselect,
  value,
  errorMsg,
}: SingleSelectProps) {
  const handleValueChange = (newValue: string) => {
    if (newValue === value) {
      onUnselect?.();
    } else {
      const option = options
        .flatMap((group) => group.options)
        .find((opt) => opt.value === newValue);
      if (option) {
        onSelect?.(option);
      }
    }
  };

  // Convert OptionGroup to ComboboxOptionGroup
  const comboboxOptions: ComboboxOptionGroup[] = options.map((group) => ({
    title: group.title,
    options: group.options.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  }));

  return (
    <Combobox
      id={id}
      options={comboboxOptions}
      value={value || ""}
      onValueChange={handleValueChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
      buttonClassName={buttonClassName}
      className={className}
      errorMsg={errorMsg}
    />
  );
}
