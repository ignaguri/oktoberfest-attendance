"use client";

import { useState, useEffect } from "react";
import { SelectBase, Option, SelectBaseProps } from "./SelectBase";

interface SingleSelectProps
  extends Pick<
    SelectBaseProps,
    | "buttonClassName"
    | "options"
    | "placeholder"
    | "searchPlaceholder"
    | "emptyMessage"
    | "disabled"
  > {
  onSelect?: (option: Option) => void;
  onUnselect?: () => void;
  value?: string | null;
}

export function SingleSelect({
  buttonClassName,
  disabled,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onSelect,
  onUnselect,
  value,
}: SingleSelectProps) {
  const [selected, setSelected] = useState<Option | null>(null);

  useEffect(() => {
    if (value) {
      const option = options
        .flatMap((group) => group.options)
        .find((opt) => opt.value === value);
      if (option) {
        setSelected(option);
      }
    } else {
      setSelected(null);
    }
  }, [value, options]);

  const handleSelect = (option: Option) => {
    if (selected?.value === option.value) {
      setSelected(null);
      onUnselect?.();
    } else {
      setSelected(option);
      onSelect?.(option);
    }
  };

  return (
    <SelectBase
      buttonClassName={buttonClassName}
      options={options}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      value={selected || ({} as Option)}
      onSelect={handleSelect}
      renderValue={() => null}
      renderTrigger={(value) =>
        (value as Option)?.label || placeholder || "Select option"
      }
    />
  );
}
