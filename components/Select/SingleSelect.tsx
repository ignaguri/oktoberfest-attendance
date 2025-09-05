"use client";

import type { Option, SelectBaseProps } from "./SelectBase";

import { SelectBase } from "./SelectBase";

interface SingleSelectProps
  extends Pick<
    SelectBaseProps,
    | "buttonClassName"
    | "options"
    | "placeholder"
    | "searchPlaceholder"
    | "emptyMessage"
    | "disabled"
    | "errorMsg"
  > {
  id?: string;
  onSelect?: (option: Option) => void;
  onUnselect?: () => void;
  value?: string | null;
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

  return (
    <SelectBase
      id={id}
      buttonClassName={buttonClassName}
      options={options}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      value={value || ""}
      onValueChange={handleValueChange}
      errorMsg={errorMsg}
    />
  );
}
