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
  id?: string;
  onSelect?: (option: Option) => void;
  onUnselect?: () => void;
  value?: string | null;
  closeOnSelect?: boolean;
}

export function SingleSelect({
  id,
  buttonClassName,
  disabled,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onSelect,
  onUnselect,
  value,
  closeOnSelect = true,
}: SingleSelectProps) {
  const [selected, setSelected] = useState<Option | null>(null);
  const [open, setOpen] = useState(false);

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
    if (closeOnSelect) setOpen(false);
  };

  return (
    <SelectBase
      id={id}
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
      open={open}
      setOpen={setOpen}
    />
  );
}
